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
      let yearly_summary_data : any[] = [];
      let yearly_occupation_data : any[] = [];
      for(let i = 0; i < num_links; i++) {
        let getXMLContentPayload = {
          xml_link: xml_links[i]
        }
        let scrapped_data : {} = await this.getXMLContent(ein, getXMLContentPayload)
        if(scrapped_data['sum'] != null) {
          for(let i = 0; i < scrapped_data['sum'].length; i++){
            yearly_summary_data.push(scrapped_data['sum'][i]);
          }
        }
        if(scrapped_data['occ'] != null) {
          for(let i = 0; i < scrapped_data['occ'].length; i++){
            yearly_occupation_data.push(scrapped_data['occ'][i]);
          }
        }
      }

      let getSummaryDataPayload = {
        data: yearly_summary_data
      }

      let getOccupationInfoPayload = {
        data: yearly_occupation_data
      }

      // SELECT name, year, COUNT(*) FROM IRSInfo.Employees GROUP BY name, year HAVING COUNT(*) > 1;
      // For some reason some are duplicating, use this to debug
      // https://www.db-fiddle.com/f/b2sXP7rPxAFEUJ5QHJ9w4v/0
      await this.httpService.postToAPI("/postOccupationInfo", getOccupationInfoPayload).toPromise()
      .then((res : any) => {
        if(res["statusCode"] == 200) {
          console.log(res["body"]["added"] + " rows have been added to Employees")
        }
        if(res["statusCode"] == 404) {
          console.log("All rows in batch already in Employees")
        }
      })
      .catch(err => {
        console.log(getOccupationInfoPayload);
        console.log(err)
      })

      await this.httpService.postToAPI("/postSummaryData", getSummaryDataPayload).toPromise()
      .then((res : any) => {
        if(res["statusCode"] == 200) {
          console.log(res["body"]["added"] + " rows have been added to Summary")
        }
        if(res["statusCode"] == 404) {
          console.log("All rows in batch already in Summary")
        }
      })
      .catch(err => {
        console.log(getSummaryDataPayload);
        console.log(err)
      })
    })
    .catch(err => {
      console.log(err)
    })
  }

  async getXMLContent (ein : number, getXMLContentPayload : any) {
    let send : {} = {};
    await this.httpService.postToAPI("/getXMLContent", getXMLContentPayload).toPromise()
    .then(async (res : any) => {
      let xmlContent = res['body']
      let xml = new window.DOMParser().parseFromString(xmlContent, "text/xml");
      if ((xml.querySelectorAll("TaxPeriodEndDt").item(0) == null) && (xml.querySelectorAll("IRS990 > Form990PartVIISectionAGrp").item(0) == null)) return;
      let end_year : any = xml.querySelectorAll("TaxPeriodEndDt").item(0).textContent?.substring(0,4)
      end_year = parseInt(end_year,10)

      let company_wide_compensation = 0
      let total_reported_employees = 0
      let num_of_titles = {
        "Vice President" : 0 ,
        "Vice Provost" : 0,
        "President" : 0, 
        "Provost" : 0, 
        "VP" : 0, 
        "Trustee" : 0,
        "Dean" : 0, 
        "Exec" : 0, 
        "Prof" : 0,
        "Treas" : 0,
        "Secretary" : 0,
        "Chief" : 0,
        "Dept Head" : 0,
        "Other" : 0
      }
      let all_occupations = xml.querySelectorAll("IRS990 > Form990PartVIISectionAGrp")
      let scrapped_occupation_data : {}[] = []
      for(let i = 0; i < all_occupations.length; i++) {
        let occupation_xmlContent = all_occupations.item(i).outerHTML
        let occupation_xml = new window.DOMParser().parseFromString(occupation_xmlContent, "text/xml")
        let name : any = ""
        
        name = occupation_xml.getElementsByTagName("PersonNm").item(0)?.textContent
        if (name == null){
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

        total_reported_employees++;
        company_wide_compensation += total_comp;
        
        let title : any = occupation_xml.getElementsByTagName("TitleTxt").item(0)?.textContent
        let title_group = this.get_title_group(title);
        num_of_titles[title_group]++;

        let payload = {
          ein        : ein,
          year       : end_year,
          name       : name,
          title      : title,
          title_group: title_group,
          base_comp  : base_comp,
          other_comp : other_comp,
          total_comp : total_comp
        }

        scrapped_occupation_data.push(payload)
      }

      let pyTotalRevenue : any = xml.getElementsByTagName("PYTotalRevenueAmt").item(0)?.textContent
      pyTotalRevenue = parseInt(pyTotalRevenue, 10)
      let cyTotalRevenue : any = xml.getElementsByTagName("CYTotalRevenueAmt").item(0)?.textContent
      cyTotalRevenue = parseInt(cyTotalRevenue, 10)
      let pyNetRevenue : any = xml.getElementsByTagName("PYRevenuesLessExpensesAmt").item(0)?.textContent
      pyNetRevenue = parseInt(pyNetRevenue, 10)
      let cyNetRevenue : any = xml.getElementsByTagName("CYRevenuesLessExpensesAmt").item(0)?.textContent
      cyNetRevenue = parseInt(cyNetRevenue, 10)
      let average_comp_per_reported = 0
      let net_over_comp_index = 0
      try {
        average_comp_per_reported = company_wide_compensation / total_reported_employees
      } catch {
        average_comp_per_reported = 0
      }
      try {
        net_over_comp_index = cyNetRevenue / company_wide_compensation
      } catch {
        net_over_comp_index = 0
      }

      let subPayloadSummaryData = {
        year : end_year,
        school : this.nick,
        revenue : cyTotalRevenue,
        netIncome : cyNetRevenue,
        totalEmployeeComp : company_wide_compensation,
        averageComp : average_comp_per_reported,
        netCompIndex : net_over_comp_index,
        totalEmployee : total_reported_employees,
        title_count : num_of_titles
      }

      let summaryData : {}[] = [];
      summaryData.push(subPayloadSummaryData);

      send = {
        'sum': summaryData,
        'occ': scrapped_occupation_data
      };

    })
    .catch(err => {
      console.log(err)
    })
    return send;
  }

  get_title_group(title_name : string) {
    let tg = "Other";
    let t = title_name.toLowerCase();
    let list_of_titles = [
        "Vice President",
        "Vice Provost",
        "President", 
        "Provost", 
        "VP", 
        "Trustee",
        "Dean", 
        "Exec", 
        "Prof",
        "Treas",
        "Secretary",
        "Chief",
        "Dept Head"
    ];
    
    for (let i = 0; i < list_of_titles.length; i++) {
      if(t.includes(list_of_titles[i].toLowerCase())) {
        tg = list_of_titles[i];
        break;
      }
    }
    return tg;

  }

}
