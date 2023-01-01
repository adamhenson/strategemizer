import fetch from 'node-fetch';
import {
  EMAIL_API_TOKEN,
  EMAIL_API_URL,
  EMAIL_API_TEMPLATE_ID,
  EMAIL_API_TO,
} from '../config';

// this function communicates with an endpoint that will send notifications
// via SendGrid API. by not setting either ENV vars above, you can opt out
export default async ({
  asm,
  dynamicTemplateData,
}: {
  asm?: any;
  dynamicTemplateData: any;
}): Promise<any> => {
  const response = await fetch(EMAIL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(asm && { asm }),
      dynamicTemplateData,
      templateId: EMAIL_API_TEMPLATE_ID,
      to: EMAIL_API_TO,
      token: EMAIL_API_TOKEN,
    }),
  });
  return await response.json();
};
