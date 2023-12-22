import { Component } from '@angular/core';
import { HttpServiceService } from '../services/http-service.service';

@Component({
  selector: 'app-home-page',
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.css']
})
export class HomePageComponent {
  org;
  searched_org = "loading...";
  nick;
  ein;
  status = "";
  failed = false;
  step1 = true;
  step2 = false;
  step3 = false;
  status_messages : string[] = [];
  complete = false;
  
  constructor(private httpService: HttpServiceService) {}

  reset() {
    this.org = ""
    this.searched_org = "loading...";
    this.nick = "";
    this.ein = 0;
    this.status = "";
    this.failed = false;
    this.step1 = true;
    this.step2 = false;
    this.step3 = false;
    this.status_messages = [];
    this.complete = false;
  }
  
  async addToDatabase() {
    let getEinCodePayload = {
      organization: this.org
    }
    this.httpService.postToAPI("/getEinCode", getEinCodePayload).subscribe(
      (response) => {
        this.ein = response['body']

        let getTitlePayload = {
          ein: this.ein
        }

        this.httpService.postToAPI("/getPropublicaTitle", getTitlePayload).subscribe(
          (response) => {
            this.searched_org = response['body']
          },
          (error) => { console.log(error) }
        )
      },
      (error) => {
        this.status = this.org + " could not be found"
        console.log(error)
      }
    )
  }

  async onBadFind() {
    let deleteEinInfoPayload = {
      ein: this.ein
    }
    this.httpService.postToAPI("/deleteEinInfo", deleteEinInfoPayload).subscribe(
      (response) => {
        if(response['statusCode'] == 200){
          this.status = "Bad ein removed"
        } else {
          this.status = "Bad ein could not be removed"
        }
      },
      (error) => { console.log(error) }
    )

  }

  async onSuccessfulFind () {
    let postEinCodePayload = {
      ein:          this.ein,
      organization: this.org,
      nickname:     this.nick
    }
    
    this.status_messages.push("Adding ein information to database...");
    this.httpService.postToAPI("/postEinCode", postEinCodePayload).subscribe(
      (response) => {
        if (response['statusCode'] == 200){
          this.status_messages.push("Adding college info...");
          this.getCollegeInfo(this.ein);
        } else if (response['statusCode'] == 300) {
          this.status_messages.push("-> Info already recorded");
          this.status_messages.push("Updating college info...");
          this.getCollegeInfo(this.ein);
        } else {
          this.status_messages.push("Error occured adding ein info to database");
        }
      },
      (error) => {
        console.log(error)
      }
    )
  }

  async getCollegeInfo (ein : number) {
    let getXMLLinksPayload = {
      ein: ein
    }
    this.status_messages.push("Requesting XML links...")
    this.httpService.postToAPI("/getXMLLinks", getXMLLinksPayload).toPromise()
    .then(async (res : any) => {

      let xml_links = res["xml_links"]
      let num_links = res["num_links"] // Replace i < num_links
      let yearly_summary_data : any[] = [];
      let yearly_occupation_data : any[] = [];
      this.status_messages.push("Getting summary and occupation data....")
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
      this.status_messages.push("Adding occupation data to database...")
      await this.httpService.postToAPI("/postOccupationInfo", getOccupationInfoPayload).toPromise()
      .then((res : any) => {
        if(res["statusCode"] == 200) {
          this.status_messages.push("-> " + res["body"]["added"] + " rows have been added to Employees")
        }
        if(res["statusCode"] == 404) {
          this.status_messages.push("-> All rows in batch already in Employees")
        }
      })
      .catch(err => {
        console.log(getOccupationInfoPayload);
        console.log(err)
      })

      this.status_messages.push("Adding summary data to database");
      await this.httpService.postToAPI("/postSummaryData", getSummaryDataPayload).toPromise()
      .then((res : any) => {
        if(res["statusCode"] == 200) {
          this.status_messages.push("-> " + res["body"]["added"] + " rows have been added to Summary")
        }
        if(res["statusCode"] == 404) {
          this.status_messages.push("-> All rows in batch already in Summary")
        }
      })
      .catch(err => {
        console.log(getSummaryDataPayload);
        console.log(err)
      })
      this.status_messages.push("Successfully Added All College Info!");
      this.complete = true;
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
      let average_comp_per_reported = company_wide_compensation / total_reported_employees
      if (!isFinite(average_comp_per_reported)) average_comp_per_reported = 0;
      let net_over_comp_index = cyNetRevenue / company_wide_compensation
      if (!isFinite(net_over_comp_index)) net_over_comp_index = 0;

      if(this.nick == "QCC") {
        console.log(average_comp_per_reported + " " + net_over_comp_index)
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
