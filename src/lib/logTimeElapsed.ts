import moment, { Moment } from 'moment-timezone';

moment.tz.setDefault('America/New_York');

const logTimeElapsed = (
  startTime: Moment,
): { timeAtCompletion: string; timeElapsed: string } => {
  const endTime = moment();
  const diffDays = endTime.diff(startTime, 'days');
  const diffHours = endTime.diff(startTime, 'hours');
  const diffMinutes = endTime.diff(startTime, 'minutes');
  const diffSeconds = endTime.diff(startTime, 'seconds');
  let timeElapsed: string;
  if (diffDays > 0) {
    const unitText = diffDays === 1 ? 'day' : 'days';
    timeElapsed = `${diffDays.toFixed(2)} ${unitText}`;
  } else if (diffHours > 0) {
    const unitText = diffHours === 1 ? 'hour' : 'hours';
    timeElapsed = `${diffHours.toFixed(2)} ${unitText}`;
  } else if (diffMinutes > 0) {
    const unitText = diffMinutes === 1 ? 'minute' : 'minutes';
    timeElapsed = `${diffMinutes} ${unitText}`;
  } else {
    const unitText = diffSeconds === 1 ? 'second' : 'seconds';
    timeElapsed = `${diffSeconds} ${unitText}`;
  }

  const timeAtCompletion = moment().format('hh:mma, MM/DD/YYYY');
  console.log(`✔️ completed in ${timeElapsed} at ${timeAtCompletion} EST`);
  return { timeAtCompletion, timeElapsed };
};

export default logTimeElapsed;
