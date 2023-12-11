import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomePageComponent } from './home-page/home-page.component';
import { ExportPageComponent } from './export-page/export-page.component';
import { VizPageComponent } from './viz-page/viz-page.component';
import { FaqPageComponent } from './faq-page/faq-page.component';

const routes: Routes = [
  {
    path: 'search',
    component: HomePageComponent,
  },
  {
    path: 'export',
    component: ExportPageComponent
  },
  {
    path: 'viz',
    component: VizPageComponent
  },
  {
    path: 'faq',
    component: FaqPageComponent
  },
  {
    path: '**',
    redirectTo : '/search',
    pathMatch : 'full',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
