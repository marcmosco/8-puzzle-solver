import {Component, signal} from '@angular/core';
import {PuzzleComponent} from './puzzle/puzzle.component';
import {RouterOutlet} from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('8-puzzle-solver');
}
