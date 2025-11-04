import { Routes } from '@angular/router';
import {PuzzleComponent} from './puzzle/puzzle.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component:PuzzleComponent
  },
];
