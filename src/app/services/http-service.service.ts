import { HttpClient, HttpHeaders } from  '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class HttpServiceService {
  
  private IRS990API = 'https://x53hil3tx9.execute-api.us-east-2.amazonaws.com/Prod';

  constructor(private http: HttpClient) { }

  getFromAPI(lambda : string) {
    return this.http.get(this.IRS990API+lambda);
  }

  postToAPI(lambda : string, payload){
    return this.http.post(this.IRS990API+lambda, JSON.stringify(payload));
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
