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
    this.httpService.getEinCode(this.org).subscribe(
      (response) => {
        let einValue = response['organizations'][0]['ein']
        let payload = {
          ein:          einValue,
          organization: this.org,
          nickname:     this.nick
        }
    
        this.httpService.postToAPI("/getEin", payload).subscribe(
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

  getCollegeInfo (ein : number) {
    this.httpService.getWebContent(ein).subscribe(
      (response) => {
        let responseText = document.createElement('html');
        responseText.innerHTML = response;
        let a_tags = responseText.getElementsByTagName('a');
        let xml_tags : any[] = [];
        for (let i = 0; i < a_tags.length; i++) {
          if(a_tags.item(i)?.innerText == "XML"){ 
            xml_tags.push("https://projects.propublica.org" + a_tags.item(i)?.href.substring(21, a_tags.item(i)?.href.length));
          }
        }
        for (let i = 0; i < xml_tags.length; i++) {
          this.httpService.getXMLContent(xml_tags[i]).subscribe(
            (response) => {
              let xml = new window.DOMParser().parseFromString(response, "text/xml");
              console.log(xml.getElementsByTagName("TaxPeriodEndDt").item(0))
            },
            (error) => {
              console.log(error)
            }
          )
        }

      },
      (error) => {
        console.log(error)
      }
    )
  }



}
