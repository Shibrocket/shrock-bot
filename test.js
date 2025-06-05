require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_BOT_API_KEY);

async function testChatMember() {
  try {
    const res = await bot.telegram.getChatMember('-1002591718243', 7684906960);
    console.log('✅ Chat Member Info:', res);
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

testChatMember();
