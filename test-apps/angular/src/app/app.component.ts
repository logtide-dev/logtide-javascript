import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { hub } from '@logtide/core';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <h1>LogTide Angular Test App</h1>
    <p data-testid="status">Ready</p>
    <button data-testid="log-button" (click)="sendLog()">Send Log</button>
    <button data-testid="error-button" (click)="triggerError()">Trigger Error</button>
    <button data-testid="http-button" (click)="makeHttpRequest()">HTTP Request</button>
    <p data-testid="result">{{ result }}</p>
  `,
})
export class AppComponent {
  private http = inject(HttpClient);
  result = '';

  sendLog() {
    const client = hub.getClient();
    client?.captureLog('info', 'manual log from angular', { route: '/test-log' });
    hub.flush();
    this.result = 'Log sent';
  }

  triggerError() {
    throw new Error('Test error from Angular');
  }

  makeHttpRequest() {
    this.http.get('http://127.0.0.1:9103/test/health').subscribe({
      next: () => {
        this.result = 'HTTP request completed';
      },
      error: (err: Error) => {
        this.result = `HTTP error: ${err.message}`;
      },
    });
  }
}
