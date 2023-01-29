import moment from 'moment-timezone';
import emailByTemplate from './emailByTemplate';

moment.tz.setDefault('America/New_York');

const { LOG_LEVEL = 'error' } = process.env;

export default class ErrorHandler {
  private notifiedErrors: any = {};

  constructor(private namespace: string, private alertThresholdMinutes = 30) {}

  async sendErrorAlert({
    error,
    priority,
  }: {
    error: Error;
    priority: number;
  }) {
    let errors = [];
    if (error.message.includes(' ACTION: ')) {
      const [errorMessage, action] = error.message.split(' ACTION: ');
      errors = [`error: ${errorMessage}`, `action: ${action}`];
    } else {
      errors = [`error: ${error.message}`];
    }

    errors.push(
      `full error: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`,
    );

    const emailResponse = await emailByTemplate({
      dynamicTemplateData: {
        messages: errors,
        subject: `[ALERT][P${priority}][production]: ${this.namespace} error`,
      },
    });

    if (!emailResponse?.status || emailResponse?.status !== 200) {
      console.log('error', error);
      throw Error('and email fail also');
    }
  }

  async handleError({
    error,
    priority = 1,
  }: {
    error: Error;
    priority?: number;
  }) {
    try {
      const momentNow = moment(new Date());

      if (!this.notifiedErrors[this.namespace]) {
        if (LOG_LEVEL.includes('verbose')) {
          console.log('setting 1st caught error', momentNow);
        }
        this.notifiedErrors[this.namespace] = momentNow;
        await this.sendErrorAlert({
          error,
          priority,
        });
      } else {
        const minutesSinceLastError = momentNow.diff(
          this.notifiedErrors[this.namespace],
          'minutes',
        );

        if (LOG_LEVEL.includes('verbose')) {
          console.log(`caught similar error ${minutesSinceLastError} minutes`);
        }

        // if we have an error that occurs more than once per threshold
        // (defualts to half hour)... then it's probably the same and
        // we don't need to send an alert
        if (minutesSinceLastError >= this.alertThresholdMinutes) {
          await this.sendErrorAlert({
            error,
            priority,
          });
          this.notifiedErrors[this.namespace] = momentNow;
        }
      }
    } catch (error) {
      console.log('error handler error', error);
    }
    console.log('error', error);
  }
}
