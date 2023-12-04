import { HttpClient, HttpHeaders } from  '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HttpServiceService {
  private propublicaAPI = 'https://projects.propublica.org/nonprofits/api/v2/search.json';
  private nonprofitWeb = 'https://projects.propublica.org/nonprofits/organizations/';
  private IRS990API = 'https://x53hil3tx9.execute-api.us-east-2.amazonaws.com/testing';




  constructor(private http: HttpClient) { }

  // NEED TO ADD CORS PROXY
  getEinCode(search_query: string) {
    // let parsed_query = "?q=" + search_query.split(" ").join("%20");
    return this.http.get(this.propublicaAPI, {
      params : {
        q: search_query
      }
    });
  }

  postToAPI(lambda : string, payload){
    return this.http.post(this.IRS990API+lambda, JSON.stringify(payload));
  }

  getWebContent(ein: number) {
    return this.http.get(this.nonprofitWeb + ein.toString(), {
      responseType: 'text'
    });
  }

  getXMLContent(link: string) {
    return this.http.get("https://cors-anywhere.herokuapp.com/" + link ,{
      responseType: 'text',
      headers : {
        'Origin' : link
      }
    });
  }

}
