import { Handler, Context, APIGatewayProxyEvent } from 'aws-lambda';
import { Server } from 'http';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as serverless from 'aws-serverless-express';
import { proxy } from 'aws-serverless-express';
import { getBotToken } from 'nestjs-telegraf';
import * as express from 'express';

let cachedServer: Server;

process.on('uncaughtException', function (error) {
  console.error("Uncaught Exception:", error);
});

process.on('unhandledRejection', function (reason, promise) {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

async function bootstrapServer(webhookCallbackBaseUrl: string): Promise<Server> {
  if (cachedServer) return cachedServer;

  const expressApp = require('express')();

  process.env.WEBHOOK_DOMAIN = webhookCallbackBaseUrl;
  process.env.WEBHOOK_PATH = '/webhook';

  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['debug', 'log', 'error', 'warn'],
  });

  await app.init();

  const bot = app.get(getBotToken());
  if (!bot) {
    throw new Error('Bot Istance is not available');
  }

  app.use(bot.webhookCallback('/webhook'));

  cachedServer = serverless.createServer(expressApp);
  return cachedServer;
}

export const handler: Handler = async (event: APIGatewayProxyEvent, context: Context) => {
  console.log("-- Event:", event);

  if (!cachedServer) {
    try {
      const webhookCallbackBaseUrl = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
      cachedServer = await bootstrapServer(webhookCallbackBaseUrl);
    } catch (error) {
      console.error('Error bootstrapping server:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal Server Error' }),
      };
    }
  }

  try {
    return await proxy(cachedServer, event, context, 'PROMISE').promise;
  } catch (error) {
    console.error('Error handling request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
