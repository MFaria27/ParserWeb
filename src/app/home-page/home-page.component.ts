import { Component } from '@angular/core';
import { HttpServiceService } from '../services/http-service.service';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent {
  org;
  nick;
  status = "";
  
  constructor(private httpService: HttpServiceService) {}
  
  addToDatabase() {
    let getEinCodePayload = {
      organization: this.org
    }
    this.httpService.postToAPI("/getEinCode", getEinCodePayload).subscribe(
      (response) => {
        let einValue = response['body']
        let postEinCodePayload = {
          ein:          einValue,
          organization: this.org,
          nickname:     this.nick
        }
    
        this.httpService.postToAPI("/postEinCode", postEinCodePayload).subscribe(
          (response) => {
            if (response['statusCode'] == 200){
              this.status = this.org + " has been found and recorded";
              this.getCollegeInfo(einValue);
            } else if (response['statusCode'] == 300) {
              this.status = this.org + " is already in the database";
              this.getCollegeInfo(einValue);
            } else {
              this.status = this.org + " could not be found"
            }
          },
          (error) => {
            console.log(error)
          }
        )
      },
      (error) => {
        this.status = this.org + " could not be found"
        console.log(error)
      }
    )
  }

  async getCollegeInfo (ein : number) {
    let getXMLLinksPayload = {
      ein: ein
    }
    this.httpService.postToAPI("/getXMLLinks", getXMLLinksPayload).toPromise()
    .then(async (res : any) => {
      let xml_links = res["xml_links"]
      let num_links = res["num_links"] // Replace i < num_links
      for(let i = 0; i < num_links; i++) {
        let getXMLContentPayload = {
          xml_link: xml_links[i]
        }
        await this.getXMLContent(ein, getXMLContentPayload)
      }
    })
    .catch(err => {
      console.log(err)
    })
  }

  async getXMLContent (ein : number, getXMLContentPayload : any) {
    await this.httpService.postToAPI("/getXMLContent", getXMLContentPayload).toPromise()
    .then(async (res : any) => {
      let xmlContent = res['body']
      let xml = new window.DOMParser().parseFromString(xmlContent, "text/xml");
      if ((xml.querySelectorAll("TaxPeriodEndDt").item(0) == null) && (xml.querySelectorAll("IRS990 > Form990PartVIISectionAGrp").item(0) == null)) return;
      let company_wide_compensation = 0
      let total_reported_employees = 0
      let end_year : any = xml.querySelectorAll("TaxPeriodEndDt").item(0).textContent?.substring(0,4)
      end_year = parseInt(end_year,10)
      let all_occupations = xml.querySelectorAll("IRS990 > Form990PartVIISectionAGrp")
      let scrapped_occupation_data : {}[] = []
      for(let i = 0; i < all_occupations.length; i++) {
        let occupation_xmlContent = all_occupations.item(i).outerHTML
        let occupation_xml = new window.DOMParser().parseFromString(occupation_xmlContent, "text/xml")
        let name : any = ""
        try {
          name = occupation_xml.getElementsByTagName("PersonNm").item(0)?.textContent
        } catch {
          name = occupation_xml.querySelectorAll("BusinessName > BusinessNameLine1Txt").item(0)?.textContent
        }
        
        let base_comp : any = 0
        let other_comp: any = 0
        try {
          base_comp = occupation_xml.getElementsByTagName("ReportableCompFromOrgAmt").item(0)?.textContent
          base_comp = parseInt(base_comp,10)
        } catch{
          base_comp = 0
        }
        try {
          other_comp = occupation_xml.getElementsByTagName("OtherCompensationAmt").item(0)?.textContent
          other_comp = parseInt(other_comp,10)
        } catch {
          other_comp = 0
        }
        let total_comp = base_comp + other_comp
        
        if (total_comp == 0) continue;
        
        let title : any = occupation_xml.getElementsByTagName("TitleTxt").item(0)?.textContent
        
        let payload = {
          ein       : ein,
          year      : end_year,
          name      : name,
          title     : title,
          base_comp : base_comp,
          other_comp: other_comp,
          total_comp: total_comp
        }

        scrapped_occupation_data.push(payload)
      }

      let getOccupationInfoPayload = {
        data: scrapped_occupation_data
      }

      // SELECT name, year, COUNT(*) FROM IRSInfo.Employees GROUP BY name, year HAVING COUNT(*) > 1;
      // For some reason some are duplicating, use this to debug
      // https://www.db-fiddle.com/f/b2sXP7rPxAFEUJ5QHJ9w4v/0
      await this.httpService.postToAPI("/postOccupationInfo", getOccupationInfoPayload).toPromise()
      .then((res : any) => {
        if(res["statusCode"] == 200) {
          console.log(res["body"]["added"] + " rows have been added to the Database")
        }
        if(res["statusCode"] == 404) {
          console.log("All rows in batch already in database")
        }
      })
      .catch(err => {
        console.log(getOccupationInfoPayload);
        console.log(err)
      })

    })
    .catch(err => {
      console.log(err)
    })
  }

}
