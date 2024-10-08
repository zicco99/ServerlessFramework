import { Context, Scenes } from "telegraf";

import { CreateAuctionIntentExtra } from "src/auctions/wizards/create-auction.wizard";


/**
 * A type that extends the default Context with SessionSpace,
 * which is used to store user session data.
 * It extends the default Context and Scene Context.
 */
export interface BotContext extends Context, Scenes.WizardContext {
  session_space: SessionSpace<IntentExtra>;
}


interface SessionSpace<T extends IntentExtra> {
    username?: string;            
    firstName: string;            // The user's first name
    lastName?: string;            // The user's last name (optional)
    languageCode?: string;        // The user's preferred language code (optional)
    chatId: number;               // The unique identifier for the chat
    last_intent : Intent;
    last_intent_extra : T;
    last_intent_timestamp : string;
    firstInteraction: string;       // The timestamp of the user's first interaction with the bot
    initialContext?: string;      // Information about the initial context of the interaction (e.g., command used)
    preferences?: Preferences;    // An object to store user-specific preferences (optional)
}

enum Intent {
    VIEW_AUCTIONS = "VIEW_AUCTIONS",
    CREATE_AUCTION = "CREATE_AUCTION",
    START = "start",
    HELP = "help",
    NONE = "none",
}

interface IntentExtra{
  data: any;
}

interface Preferences {
    notificationTime?: string;  
    contentLanguage?: string;
}

function showSessionSpace<T extends IntentExtra>(userId: number, user: SessionSpace<T>) : string {
    return `\n User ID: ${userId}\n` +
           `Username: ${user.username}\n` +
           `First Name: ${user.firstName}\n` +
           `Last Name: ${user.lastName}\n` +
           `Language: ${user.languageCode}\n` +
           `Preferences:\n` +
           `  Notification Time: ${user.preferences?.notificationTime}\n` +
           `  Content Language: ${user.preferences?.contentLanguage}\n`;
}

async function getOrInitUserSessionSpace<T extends IntentExtra>(
  userId: number,
  ctx: BotContext,  
  getSessionSpaceBind : (userId: number) => Promise<SessionSpace<T> | null>, 
  initSessionSpace : (userId: number, session: SessionSpace<T>) => Promise<SessionSpace<T>>) : Promise<{session_space: SessionSpace<T> | null,
  session_newly_created: boolean}
  >{
    
    let session_space = await getSessionSpaceBind(userId);
    const session_newly_created = session_space === null;

    if (!session_space) {
      session_space = {
        chatId: ctx.chat?.id || 0,
        firstName: ctx.from?.first_name || '',
        lastName: ctx.from?.last_name || '',
        firstInteraction: new Date().toISOString(),
        languageCode: ctx.from?.language_code || '',
        last_intent: Intent.NONE,
        last_intent_extra: {} as T,
        last_intent_timestamp: "",
        initialContext: JSON.stringify({
          chat: ctx.chat,
          message: ctx.message,
          from: ctx.from,
        }),
      };

      

      console.log("Found no session space, created new one: ", session_space);
      await initSessionSpace(userId, session_space);
      console.log("New session space saved!")
    }
    return { session_space, session_newly_created };
}

export { SessionSpace, Preferences, Intent, IntentExtra, showSessionSpace, getOrInitUserSessionSpace };
