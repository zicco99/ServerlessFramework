// src/lambda.ts
import { Handler, Context, APIGatewayProxyEvent } from 'aws-lambda';
import { Server } from 'http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as serverless from 'aws-serverless-express';
import { proxy } from 'aws-serverless-express';
import { getBotToken } from 'nestjs-telegraf';

let cachedServer: Server;

process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection at:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

async function bootstrapServer(webhookCallbackBaseUrl: string): Promise<Server> {
  console.log("Webhook Callback Base URL:", webhookCallbackBaseUrl);

  const expressApp = require('express')();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['debug', 'log', 'error', 'warn'],
  });

  const bot = app.get(getBotToken());
  if (!bot) {
    throw new Error('Telegraf instance is not available');
  }

  app.use(bot.webhookCallback('/webhook'));

  try {
    const webhookInfo = await bot.telegram.getWebhookInfo();
    if (webhookInfo.url && webhookInfo.url !== `${webhookCallbackBaseUrl}/webhook`) {
      console.log('Existing webhook URL detected. Deleting existing webhook.');
      await bot.telegram.deleteWebhook();
    }
  } catch (error) {
    console.error('Error getting or deleting existing webhook:', error);
  }
  try {
    await bot.telegram.setWebhook(`${webhookCallbackBaseUrl}/webhook`, {
      drop_pending_updates: true,
      allowed_updates: [
        'message',
        'edited_message',
        'channel_post',
        'edited_channel_post',
        'callback_query',
        'inline_query',
        'chosen_inline_result',
        'shipping_query',
        'pre_checkout_query',
        'poll',
        'poll_answer'
      ],
    });
    console.log('Webhook set successfully');
  } catch (error) {
    console.error('Error setting webhook:', error);
  }

  await app.init();
  return serverless.createServer(expressApp);
}

export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context) => {
  if (!cachedServer) {
    const webhookCallbackBaseUrl = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
    cachedServer = await bootstrapServer(webhookCallbackBaseUrl);
  }
  return proxy(cachedServer, event, context, 'PROMISE').promise;
};
