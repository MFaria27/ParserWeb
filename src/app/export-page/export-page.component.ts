import { Component, OnInit } from '@angular/core';
import { HttpServiceService } from '../services/http-service.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-export-page',
  templateUrl: './export-page.component.html',
  styleUrls: ['./export-page.component.css']
})
export class ExportPageComponent implements OnInit{

  all_organizations : {}[] = [];
  selected_organizations : {}[] = [];
  selected_nicks : any[] = [];
  selected_eins : any[] = [];
  card_view : boolean = true;
  filename = 'sheet.xlsx';

  constructor(private httpService: HttpServiceService) {}

  async ngOnInit() {
    await this.getAllOrganizations();
  }

  async writeToExcel () {
    const wb: XLSX.WorkBook = XLSX.utils.book_new();

    let summary_sheet_payload = [
      ["Year", "School", "Revenue", "Net Income", "Total Employee Comp", "Average Comp", "Net/Comp Index", "Total Employees", "Presidents", "Vice Presidents", "Provosts", "Trustees", "Deans", "Executives", "Professors", "Treasurers", "Secretaries", "Chiefs", "Dept Heads", "Other"]
    ];
    let summaryPayload = {
      schools : this.selected_nicks
    }
    await this.httpService.postToAPI("/getAllSummary", summaryPayload).toPromise()
    .then(async (response:any) => {
      if(response["statusCode"] == 200) {
        response["body"].forEach(row => {
          let add_to_payload = [
            row["year"], row["school"], row["revenue"], row["netIncome"], row["totalEmployeeComp"], row["averageComp"], row["netCompIndex"], row["totalEmployee"],
            row["presidents"], row["vicePresidents"], row["provosts"], row["trustees"], row["deans"], row["executives"], row["professors"], row["treasurers"], row["secretaries"], row["chiefs"], row["deptHeads"], row["other"]
          ];
          summary_sheet_payload.push(add_to_payload);
        });
      }
    })
    .catch(err => {
      console.log(err)
    });

    var summary_worksheet = XLSX.utils.aoa_to_sheet(summary_sheet_payload);
    XLSX.utils.book_append_sheet(wb, summary_worksheet, "summary");

    let occupationPayload = {
      eins : this.selected_eins
    }
    await this.httpService.postToAPI("/getAllOccupation", occupationPayload).toPromise()
    .then(async (response:any) => {
      if(response["statusCode"] == 200) {
        this.selected_eins.forEach(ein => {
          let occupation_sheet_payload : any = [
            ["Year", "Name", "Title", "Title Group", "Base Compensation", "Other Compensation", "Total Compensation"]
          ]
          response["body"].forEach(row => {
            if(row['ein'] == ein) {
              let add_to_payload = [
                row["year"], row["name"], row["title"], row["title_group"], row["base_comp"], row["other_comp"], row["total_comp"]
              ];
              occupation_sheet_payload.push(add_to_payload);
            }
          });
          var individual_worksheet = XLSX.utils.aoa_to_sheet(occupation_sheet_payload);
          let indexOfEin = this.selected_eins.findIndex(x => x == ein);
          XLSX.utils.book_append_sheet(wb, individual_worksheet, this.selected_nicks[indexOfEin]);
        });
      }
    })
    .catch(err => {
      console.log(err)
    });

    XLSX.writeFile(wb, this.filename);

    this.selected_organizations.splice(0, this.selected_organizations.length);
    this.selected_nicks.splice(0, this.selected_nicks.length);
    this.selected_eins.splice(0, this.selected_eins.length);
  }

  async getAllOrganizations () {
    await this.httpService.getFromAPI("/getAllEin").toPromise()
      .then(async (response:any) => {
        if (response['statusCode'] == 200){
          this.all_organizations = response['body'];
        } else {
          console.log(response['body'])
        }
      })
      .catch(err => {
        console.log(err)
      });
  }

  editSelected(org : {}) {
    if (this.selected_organizations.includes(org)){
      let removeThisIndex = this.selected_organizations.findIndex(x => x == org);
      this.selected_organizations.splice(removeThisIndex, 1);
      this.selected_nicks.splice(removeThisIndex,1);
      this.selected_eins.splice(removeThisIndex,1);
    } else { 
      this.selected_organizations.push(org); 
      this.selected_nicks.push(org['nickname']);
      this.selected_eins.push(org['ein']);
    }
  }

}
