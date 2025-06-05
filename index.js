// Load environment variables from .env file
require('dotenv').config();
const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');
const moment = require('moment');
// 🔐 Check if user is admin
const isAdmin = async (userId) => {
  try {
    const doc = await db.collection('admins').doc(userId.toString()).get();
    return doc.exists && doc.data().isAdmin === true;
  } catch (err) {
    console.error('Error checking admin status:', err);
    return false;
  }
};
const today = moment().format('YYYY-MM-DD');
const MIN_WITHDRAW_AMOUNT = 1000000; // Set a minimum to avoid spam
const { ethers } = require('ethers');
const escapeMarkdown = (text) => {
  return text.replace(/[_*[()~`>#+=|{}.!\\-]/g, '\\$&');
};

const provider = new ethers.JsonRpcProvider(process.env.EGON_RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const SHROCK_ABI = [
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)"
];

const SHROCK = new ethers.Contract(process.env.SHROCK_CONTRACT, SHROCK_ABI, wallet);

admin.initializeApp({
  credential: admin.credential.cert({
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
  }),
  databaseURL: 'https://your-firebase-db.firebaseio.com'
});

const db = admin.firestore();
const bot = new Telegraf(process.env.TELEGRAM_BOT_API_KEY);

// Replace with your actual group/channel usernames
const CHANNEL_USERNAME = '@ShibaRocketPack';
const GROUP_CHAT_ID = '-1002591718243';

// 🔐 Middleware to verify Telegram group and channel membership
bot.use(async (ctx, next) => {
  if (!ctx.from) return; // ✅ Prevents crashing on channel posts or system messages

  const userId = ctx.from.id;

  try {
    const isInChannel = await ctx.telegram.getChatMember(CHANNEL_USERNAME, userId);
    const isInGroup = await ctx.telegram.getChatMember(GROUP_CHAT_ID, userId);

    if (
      isInChannel.status === 'left' || isInChannel.status === 'kicked' ||
      isInGroup.status === 'left' || isInGroup.status === 'kicked'
    ) {
      await ctx.replyWithMarkdownV2(
        `🚨 *To use this bot, you must:*\n\n` +
        `👉 Join the channel: [@ShibaRocketPack](https://t\\.me/ShibaRocketPack)\n` +
        `👉 Join the group: [Join Group](https://t\\.me/+H5CoA\\-cwnRk0MGM8)\n\n` +
        `✅ *After joining, type* \`/start\` *again to continue\\.*`
      );
      return;
    }

    return next();
  } catch (err) {
    console.error('Membership verification failed:', err);
    return ctx.reply('⚠️ We couldn’t verify your group/channel membership. Please try again.');
  }
});

bot.use(async (ctx, next) => {
  try {
    const walletBalanceRaw = await SHROCK.balanceOf(wallet.address);
    const walletBalance = Number(ethers.formatUnits(walletBalanceRaw, 9)); // SHROCK uses 9 decimals

    if (walletBalance <= 0) {
      await ctx.reply('🚫 *Airdrop has ended.*\n\nThis bot is now inactive because the $SHROCK wallet is empty.', {
        parse_mode: 'Markdown'
      });
      return; // ⛔ stop further processing
    }

    return next();
  } catch (err) {
    console.error('⚠️ Error checking wallet balance middleware:', err);
    await ctx.reply('⚠️ Something went wrong. Please try again later.');
    return;
  }
});


// /start command
bot.start(async (ctx) => {
  const userId = ctx.from.id.toString();
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  const today = moment().format('YYYY-MM-DD');

  try {
    // 1. Register new user if not exist
    if (!userDoc.exists) {
      await userRef.set({
        referrals: 0,
        tasksCompleted: 0,
        shrockEarned: 0,
        lastClaim: today,
        streak: 1,
        referredBy: null
      });
    }

    // 2. Handle referral
    const payload = ctx.startPayload;
    if (payload && payload !== userId) {
      const referrerId = payload.toString();
      const referrerRef = db.collection('users').doc(referrerId);
      const referrerDoc = await referrerRef.get();

      const user = (await userRef.get()).data();
      if (!user.referredBy && referrerDoc.exists) {
        // ✅ Give rewards to referrer and referred user
        await userRef.update({
          referredBy: referrerId,
          shrockEarned: admin.firestore.FieldValue.increment(150000)
        });

        await referrerRef.update({
          referrals: admin.firestore.FieldValue.increment(1),
          shrockEarned: admin.firestore.FieldValue.increment(300000)
        });

        ctx.reply('🎉 You joined via referral! +150,000 $SHROCK');
        bot.telegram.sendMessage(referrerId, `🎉 Your referral joined! +300,000 $SHROCK for you.`);
      }
    }

    // 3. Show Welcome Message
    ctx.replyWithMarkdownV2(
      `✅ *You're verified\\!*\n\n` +
      `Welcome to the *ShibaRocket Pack\\!* 🚀🐾\n\n` +
      `💥 *ShibaRocket* \$SHROCK\ is the ultimate meme\\-powered trip to the moon\\!\n` +
      `Fueled by the spirit of the Shiba Inu and powered by the *Egon Blockchain*, $SHROCK is made for dreamers, degens, and meme lords\\.\n\n` +
      `🎯 No promises — just vibes\\. Hodl and howl\\. Let’s moon together\\!\n\n` +
      `🔹 *Token Details*\n` +
      `• Name: ShibaRocket\n` +
      `• Symbol: $SHROCK\n` +
      `• Supply: 1\\,000\\,000\\,000\\,000 \1 Trillion\\n` +
      `• Decimals: 9\n` +
      `• Blockchain: Egon \EGC\\_20\\n\n` +
      `🔗 *Website:* https://linktr\\.ee/ShibaRocket\\_\n\n` +
      `🆘 *Getting Started*\n` +
      `1️⃣ Use /task to view and complete tasks\n` +
      `2️⃣ Use /submit to submit proof\n` +
      `3️⃣ Use /claim daily to get rewards\n` +
      `4️⃣ Use /withdraw to withdraw your $SHROCK\n` +
      `5️⃣ Use /referral to invite friends and earn more\\!\n\n` +
      `🔐 *Need a Wallet?*\n` +
      `Download *Egon Wallet* or use *MetaMask* with EGC\\_20:\n\n` +
      `📲 *Egon Wallet:* https://play\\.google\\.com/store/apps/details\\?id\\=com\\.egon\\.wallet\n\n` +
      `🦊 *Add Egon Chain to MetaMask:*\n` +
      `\`\`\`\n` +
      `Network: Egon Mainnet\n` +
      `RPC: https://rpc.egonscan.com\n` +
      `Chain ID: 271\n` +
      `Symbol: EGON\n` +
      `Block Explorer: https://egonscan.com\n` +
      `\`\`\`\n\n` +
      `🪙 *$SHROCK Token Info*\n` +
      `• Contract: \`0xab17Cee8Af9932faE211DDf1c881ef17810d3da8\`\n` +
      `• View: https://egonscan\\.com/token/0xab17Cee8Af9932faE211DDf1c881ef17810d3da8\n\n` +
      `👉 *Start earning now\\!* Type /task to begin\\!`
    );
  } catch (error) {
    console.error('❌ Verification failed:', error);
    ctx.reply('⚠️ An error occurred while verifying your membership. Please try again later.');
  }
});

// /task command with pagination and details
bot.command('task', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userRef = db.collection('users').doc(userId);

  // Parse page number (e.g. /task 2)
  const parts = ctx.message.text.trim().split(' ');
  const page = parseInt(parts[1]) || 1;
  const pageSize = 5;
  const startIndex = (page - 1) * pageSize;

  try {
    const userDoc = await userRef.get();
    const userData = userDoc.exists ? userDoc.data() : {};
    const completedTasks = userData.completedTasks || [];

    const tasksSnapshot = await db.collection('tasks')
      .where("status", "==", "active")
      .get();

    const allTasks = [];
    tasksSnapshot.forEach(doc => {
      const task = doc.data();
      const taskId = doc.id;

      if (!completedTasks.includes(taskId)) {
        allTasks.push({
          id: taskId,
          name: task.task_name,
          reward: task.reward,
          requires: task.requires || 'username',
          details: task.details || ''
        });
      }
    });

    if (allTasks.length === 0) {
      ctx.reply('✅ You’ve completed all active tasks! Check back later for more.');
      return;
    }

    const pagedTasks = allTasks.slice(startIndex, startIndex + pageSize);
    if (pagedTasks.length === 0) {
      ctx.reply(`⚠️ No tasks found on page ${page}. Try /task 1.`);
      return;
    }

    const taskOptions = [];
    let taskList = `📋 Available Tasks (Page ${page}):\n\n`;

    pagedTasks.forEach((task, index) => {
      const i = startIndex + index + 1;
      taskOptions.push({
        index: i,
        id: task.id,
        name: task.name,
        requires: task.requires,
        details: task.details
      });

      taskList += `${i}. ${task.name} — Earn ${task.reward} $SHROCK\n`;
      taskList += `   📎 Submit: ${task.requires}\n`;
      if (task.details) {
        taskList += `   🔗 Details: ${task.details}\n`;
      }
      taskList += `\n`;
    });

    await userRef.set({ taskOptions }, { merge: true });

    taskList += `Use /task ${page + 1} to see more (if available).\n`;
    taskList += `\nPlease reply with the task number (e.g. 1) to begin.`;

    ctx.reply(taskList);
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Error loading tasks. Try again later.');
  }
});

bot.command('walletbalance', async (ctx) => {
  const userId = ctx.from.id.toString();

  // ✅ Check if the user is an admin
  if (!(await isAdmin(userId))) {
    return ctx.reply('❌ You are not authorized to view wallet balance.');
  }

  try {
    const balanceRaw = await SHROCK.balanceOf(wallet.address);
    const balance = Number(ethers.formatUnits(balanceRaw, 9)); // $SHROCK uses 9 decimals

    ctx.reply(`💰 *Bot Wallet Balance:*\n${balance.toLocaleString()} $SHROCK`, {
      parse_mode: 'Markdown'
    });
  } catch (err) {
    console.error('❌ Error fetching wallet balance:', err);
    ctx.reply('⚠️ Failed to fetch wallet balance. Try again later.');
  }
});

// /leaderboard command
bot.command('leaderboard', async (ctx) => {
  try {
    const usersRef = db.collection('users');
    const topUsersSnapshot = await usersRef
      .orderBy('shrockEarned', 'desc')
      .limit(5)
      .get();

    if (topUsersSnapshot.empty) {
      ctx.reply('📉 No leaderboard data available yet.');
      return;
    }

    let message = '🏆 Top 5 Earners:\n\n';
    let rank = 1;

    topUsersSnapshot.forEach(doc => {
      const user = doc.data();
      message += `${rank}. 🧑‍🚀 ID: ${doc.id} — ${user.shrockEarned} $SHROCK\n`;
      rank++;
    });

    ctx.reply(message);
  } catch (err) {
    console.error('Error loading leaderboard:', err);
    ctx.reply('❌ Could not load leaderboard.');
  }
});

// Admin-only: Manually mark a social task complete
bot.command('completetask', async (ctx) => {
  const senderId = ctx.from.id.toString();

  // Check admin from Firestore
  const isAdmin = async (id) => {
    const adminDoc = await db.collection('admins').doc(id).get();
    return adminDoc.exists && adminDoc.data().isAdmin === true;
  };

  if (!(await isAdmin(senderId))) {
    ctx.reply('❌ You are not authorized to use this command.');
    return;
  }

  const parts = ctx.message.text.split(' ');
  if (parts.length < 3) {
    ctx.reply('❗ Usage: /completetask [telegram_user_id] [Twitter|Instagram|YouTube]');
    return;
  }

  const targetUserId = parts[1].trim();
  const platform = parts[2].toLowerCase();
  const validPlatforms = ['twitter', 'instagram', 'youtube'];

  if (!validPlatforms.includes(platform)) {
    ctx.reply('❗ Supported platforms: Twitter, Instagram, YouTube');
    return;
  }

  try {
    const userRef = db.collection('users').doc(targetUserId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      ctx.reply('❌ User not found.');
      return;
    }

    const user = userDoc.data();
    const username = user[platform];
    const activeTask = user.activeTask;
    const completedTasks = user.completedTasks || [];

    if (!username) {
      ctx.reply(`⚠️ User has not submitted a ${platform} username yet.`);
      return;
    }

    if (!activeTask || !activeTask.taskId) {
      ctx.reply(`⚠️ User has no active task to mark as completed.`);
      return;
    }

    if (completedTasks.includes(activeTask.taskId)) {
      ctx.reply('⚠️ This task has already been completed for this user.');
      return;
    }

    const reward = 100;
    const updatedBalance = (user.shrockEarned || 0) + reward;
    const updatedTasks = (user.tasksCompleted || 0) + 1;

    await userRef.update({
      shrockEarned: updatedBalance,
      tasksCompleted: updatedTasks,
      completedTasks: admin.firestore.FieldValue.arrayUnion(activeTask.taskId),
      activeTask: admin.firestore.FieldValue.delete()
    });

    ctx.reply(
      `✅ Task marked complete!\n👤 @${username}\n📝 Task: ${activeTask.taskName}\n💰 +${reward} $SHROCK added.`
    );

  } catch (err) {
    console.error('❌ Error processing task:', err);
    ctx.reply('❌ Something went wrong. Try again.');
  }
});

bot.command('withdraw', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    ctx.reply('❌ You are not registered. Use /start first.');
    return;
  }

  const parts = ctx.message.text.trim().split(' ');
  if (parts.length < 2) {
    ctx.reply('❗ Usage: /withdraw [your_egon_wallet_address]');
    return;
  }

  const walletAddress = parts[1].trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    ctx.reply('❌ Invalid wallet address.');
    return;
  }

  const user = userDoc.data();
  const amount = user.shrockEarned || 0;
  const now = new Date();
  const lastWithdrawDate = user.withdrawnAt?.toDate?.() || null;

  const cooldownPassed = !lastWithdrawDate || (now - lastWithdrawDate) >= (24 * 60 * 60 * 1000);
  if (!cooldownPassed) {
    const remaining = 24 * 60 * 60 * 1000 - (now - lastWithdrawDate);
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    ctx.reply(`⏳ Please wait ${hours}h ${minutes}m before your next withdrawal.`);
    return;
  }

  if (amount < MIN_WITHDRAW_AMOUNT) {
    ctx.reply(`⚠️ You need at least ${MIN_WITHDRAW_AMOUNT} $SHROCK to withdraw.`);
    return;
  }

  try {
    const amountToSend = ethers.parseUnits(amount.toString(), 9);
    const tx = await SHROCK.transfer(walletAddress, amountToSend);
    await tx.wait();

    await userRef.update({
      withdrawnAt: now,
      withdrawTx: tx.hash,
      withdrawAddress: walletAddress,
      shrockEarned: 0
    });

    ctx.reply(`✅ Withdrawal successful!\n💸 TX Hash:\nhttps://egonscan.com/tx/${tx.hash}`);

    // 🔔 Wallet Instructions (MarkdownV2 safe)
    ctx.replyWithMarkdownV2(
      `📲 *How to View Your \\$SHROCK:*\n\n` +
      `🟢 *Egon Wallet:*\n` +
      `https://play\\.google\\.com/store/apps/details\\?id\\=com\\.egon\\.wallet\n\n` +
      `🦊 *MetaMask Setup:*\n` +
      `\\\`\\\`\\\`\n` + // escaped triple backticks
      `Network: Egon Mainnet\n` +
      `RPC: https://rpc\\.egonscan\\.com\n` +
      `Chain ID: 271\n` +
      `Symbol: EGON\n` +
      `Explorer: https://egonscan\\.com\n` +
      `\\\`\\\`\\\`\n\n` +
      `📄 *Token Contract:*\n` +
      `\`0xab17Cee8Af9932faE211DDf1c881ef17810d3da8\`\n\n` +
      `🔗 https://egonscan\\.com/token/0xab17Cee8Af9932faE211DDf1c881ef17810d3da8`
    );

    // 📢 Notify all admins
    const admins = await db.collection('admins').get();
    for (const doc of admins.docs) {
      await bot.telegram.sendMessage(
        doc.id,
        `📤 Sent ${amount} $SHROCK to ${walletAddress}\nTX: https://egonscan.com/tx/${tx.hash}`
      );
    }

  } catch (err) {
    console.error('❌ Error sending token:', err);
    ctx.reply('❌ Failed to send $SHROCK. Please try again later.');
  }
});

bot.command('withdrawstatus', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    ctx.reply('❌ You are not registered. Use /start first.');
    return;
  }

  const user = userDoc.data();
  const withdrawnAt = user.withdrawnAt?.toDate?.() || null;

  if (!user.hasWithdrawn || !withdrawnAt) {
    ctx.reply('✅ You have not withdrawn yet. You’re eligible to withdraw!');
    return;
  }

  const now = new Date();
  const elapsedMs = now - withdrawnAt;
  const cooldownMs = 24 * 60 * 60 * 1000;

  if (elapsedMs >= cooldownMs) {
    ctx.reply('✅ Your cooldown has expired. You can withdraw again now!');
  } else {
    const remaining = cooldownMs - elapsedMs;
    ctx.reply(`⏳ You already withdrew recently.\nPlease wait ${msToTime(remaining)} before withdrawing again.`);
  }
});

// /streak command
bot.command('streak', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    ctx.reply("❌ You're not registered yet. Use /start to begin.");
    return;
  }

  const user = userDoc.data();
  const streak = user.streak || 0;

  let lastClaimDate = user.lastClaim || 'N/A';
  if (user.lastClaim && user.lastClaim.toDate) {
    lastClaimDate = moment(user.lastClaim.toDate()).format('YYYY-MM-DD');
  }

  ctx.reply(`🔥 Your current daily claim streak: ${streak} day(s)\n📆 Last claim: ${lastClaimDate}`);
});

bot.command('claim', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  const today = moment().format('YYYY-MM-DD');

  if (!userDoc.exists) {
    await userRef.set({
      referrals: 0,
      tasksCompleted: 0,
      shrockEarned: 25000,
      lastClaim: today,
      streak: 1
    });
    ctx.reply('🎉 First daily reward claimed: +2,500 $SHROCK!');
    return;
  }

  const user = userDoc.data();
  const lastClaim = user.lastClaim || '';
  let streak = user.streak || 0;

  if (lastClaim === today) {
    ctx.reply('⏳ You already claimed your daily reward today. Come back tomorrow!');
    return;
  }

  const yesterday = moment().subtract(1, 'days').format('YYYY-MM-DD');
  streak = (lastClaim === yesterday) ? streak + 1 : 1;

  // Calculate reward based on streak
  let reward;
  switch (streak) {
    case 1: reward = 25000; break;
    case 2: reward = 27500; break;
    case 3: reward = 30000; break;
    case 4: reward = 32500; break;
    case 5: reward = 35000; break;
    case 6: reward = 37500; break;
    case 7: reward = 40000; break;
    default: reward = 25000; streak = 1; break;
  }

  await userRef.update({
    shrockEarned: (user.shrockEarned || 0) + reward,
    lastClaim: today,
    streak: streak
  });

  ctx.reply(`✅ Daily reward claimed!\n+${reward} $SHROCK 💰\n🔥 Streak: ${streak} day(s)`);
});

// /referral command
bot.command('referral', async (ctx) => {
  const userId = ctx.from.id;
  const referralLink = `https://t.me/ShibaRocket_OfficialBot?start=${userId}`;
  ctx.reply(`📢 Share your referral link:\n${referralLink}\n\nEarn $SHROCK when your friends join!`);
});

bot.command('getid', (ctx) => {
  ctx.reply(`📡 This chat's ID is: ${ctx.chat.id}`);
});

bot.command('admin', async (ctx) => {
  const senderId = ctx.from.id.toString();

  if (!(await isAdmin(senderId))) {
    ctx.reply('❌ You are not authorized to view admin tools.');
    return;
  }

  ctx.reply(
    `🛠️ Admin Tools:\n\n` +
    `/addtask Task Name | Reward | Status\n` +
    `/removetask Task Name\n` +
    `/completetask user_id platform\n` +
    `/leaderboard\n` +
    `/getid\n`
  );
});

bot.command('addtask', async (ctx) => {
  const senderId = ctx.from.id.toString();

  if (!(await isAdmin(userId))) {
      ctx.reply('❌ You are not authorized to view admin tools.');
      return;
    }

  const parts = ctx.message.text.split('|');
  if (parts.length < 5) {
    ctx.reply('❗ Usage: /addtask Task Name | Reward | Status | Requires | Details');
    return;
  }

  const taskName = parts[0].replace('/addtask', '').trim();
  const reward = parseInt(parts[1].trim());
  const status = parts[2].trim().toLowerCase();
  const requires = parts[3].trim().toLowerCase();
  const details = parts[4].trim();

  if (!['active', 'inactive'].includes(status)) {
    ctx.reply('❗ Status must be "active" or "inactive".');
    return;
  }

  if (!['username', 'screenshot', 'both'].includes(requires)) {
    ctx.reply('❗ Requires must be one of: username, screenshot, both.');
    return;
  }

  try {
    await db.collection('tasks').add({
      task_name: taskName,
      reward: reward,
      status: status,
      requires: requires,
      details: details
    });

    ctx.reply(`✅ Task "${taskName}" added with ${reward} $SHROCK [${status}] (Requires: ${requires})\n🔗 Details: ${details}`);
  } catch (err) {
    console.error('Error adding task:', err);
    ctx.reply('❌ Failed to add task.');
  }
});

bot.command('removetask', async (ctx) => {
  const senderId = ctx.from.id.toString();

  if (!(await isAdmin(userId))) {
      ctx.reply('❌ You are not authorized to view admin tools.');
      return;
    }

  const taskName = ctx.message.text.replace('/removetask', '').trim();

  if (!taskName) {
    ctx.reply('❗ Usage: /removetask Task Name');
    return;
  }

  try {
    const tasksSnapshot = await db.collection('tasks')
      .where("task_name", "==", taskName)
      .get();

    if (tasksSnapshot.empty) {
      ctx.reply(`⚠️ No task found with name: "${taskName}"`);
      return;
    }

    let deletedCount = 0;

    tasksSnapshot.forEach(async (doc) => {
      await db.collection('tasks').doc(doc.id).delete();
      deletedCount++;
    });

    ctx.reply(`✅ Removed ${deletedCount} task(s) named "${taskName}".`);
  } catch (err) {
    console.error('Error removing task:', err);
    ctx.reply('❌ Failed to remove task. Please try again.');
  }
});

// /balance command
bot.command('balance', async (ctx) => {
  const userId = ctx.from.id;
  const userRef = db.collection('users').doc(userId.toString());

  try {
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      const data = userDoc.data();
      ctx.reply(`💰 Your balance: ${data.shrockEarned} $SHROCK`);
    } else {
      await userRef.set({
        referrals: 0,
        tasksCompleted: 0,
        shrockEarned: 0
      });
      ctx.reply('👤 You’ve been registered! Your balance is 0 $SHROCK.');
    }
  } catch (error) {
    console.error('Error in /balance:', error);
    ctx.reply('⚠️ Error fetching balance.');
  }
});

bot.command('stats', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    ctx.reply("❌ You're not registered yet. Use /start to begin.");
    return;
  }

  const user = userDoc.data();
  const shrock = user.shrockEarned || 0;
  const tasksCompleted = user.tasksCompleted || 0;
  const streak = user.streak || 0;
  const referrals = user.referrals || 0;

  let lastClaim = user.lastClaim;
  if (lastClaim?.toDate) {
    lastClaim = moment(lastClaim.toDate()).format('YYYY-MM-DD');
  } else {
    lastClaim = lastClaim || 'N/A';
  }

  const hasWithdrawn = user.hasWithdrawn ? '✅ Yes' : '❌ No';

  ctx.reply(
    `📊 *Your Stats:*\n\n` +
    `💰 SHROCK Earned: ${shrock}\n` +
    `✅ Tasks Completed: ${tasksCompleted}\n` +
    `🔥 Claim Streak: ${streak} day(s)\n` +
    `📆 Last Claim: ${lastClaim}\n` +
    `🤝 Referrals: ${referrals}\n` +
    `🚀 Withdrawn: ${hasWithdrawn}`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('submit', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userRef = db.collection('users').doc(userId);
  const parts = ctx.message.text.split(' ');

  if (parts.length < 3) {
    ctx.reply('❗ Usage: /submit [Twitter|Instagram|YouTube] [your_username]');
    return;
  }

  const platform = parts[1].toLowerCase();
  const username = parts.slice(2).join(' ');
  const validPlatforms = ['twitter', 'instagram', 'youtube'];

  if (!validPlatforms.includes(platform)) {
    ctx.reply('❗ Supported platforms: Twitter, Instagram, YouTube');
    return;
  }

  try {
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      ctx.reply('⚠️ You are not registered. Please use /start first.');
      return;
    }

    const user = userDoc.data();
    const activeTask = user.activeTask;
    const existing = user[platform];

    if (!activeTask) {
      ctx.reply('⚠️ You must select a task first using /task.');
      return;
    }

    if (existing) {
      ctx.reply(`⚠️ You already submitted a ${platform} username: "${existing}". Submitting again will overwrite it.`);
    }

    const updateData = {};
    updateData[platform] = username;

    // Save username and submission log
    await userRef.set(updateData, { merge: true });
    await userRef.collection('submissions').doc(activeTask.taskId).set({
      type: 'username',
      platform,
      username,
      taskName: activeTask.taskName,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    ctx.reply(`✅ Your ${platform} username "${username}" has been saved.`);

    // 🔔 Notify all admins from Firestore
    const adminsSnapshot = await db.collection('admins').get();
    adminsSnapshot.forEach(doc => {
      const adminId = doc.id;
      bot.telegram.sendMessage(adminId,
        `📥 User ${userId} submitted ${platform} username: "${username}"\n📝 Task: ${activeTask.taskName}`
      );
    });

  } catch (error) {
    console.error('Error saving username:', error);
    ctx.reply('❌ Failed to save your username. Please try again.');
  }
});

bot.command('adminstats', async (ctx) => {
  const adminId = ctx.from.id.toString();

  // Check if user is admin
  const isAdmin = async (id) => {
    const doc = await db.collection('admins').doc(id).get();
    return doc.exists && doc.data()?.isAdmin === true;
  };

  if (!(await isAdmin(adminId))) {
    ctx.reply('❌ You are not authorized to view admin stats.');
    return;
  }

  try {
    const usersSnapshot = await db.collection('users').get();
    const today = moment().format('YYYY-MM-DD');

    let totalUsers = 0;
    let totalEarned = 0;
    let totalWithdrawals = 0;
    let totalTasksCompleted = 0;
    let dailyActiveUsers = 0;

    let topUser = { id: null, earned: 0 };

    usersSnapshot.forEach(doc => {
      const data = doc.data();
      totalUsers++;
      totalEarned += data.shrockEarned || 0;
      totalTasksCompleted += data.tasksCompleted || 0;

      if (data.withdrawnAt) totalWithdrawals++;

      if (data.shrockEarned > topUser.earned) {
        topUser = { id: doc.id, earned: data.shrockEarned };
      }

      if (data.lastClaim === today) {
        dailyActiveUsers++;
      }
    });

    const statsMessage =
      `📊 *Admin Stats*\n\n` +
      `👥 Total Users: ${totalUsers}\n` +
      `💰 Total SHROCK Earned: ${totalEarned}\n` +
      `📤 Total Withdrawals: ${totalWithdrawals}\n` +
      `✅ Total Tasks Completed: ${totalTasksCompleted}\n` +
      `📅 Today's Active Users: ${dailyActiveUsers}\n` +
      `🥇 Top Earner: ${topUser.id} with ${topUser.earned} SHROCK\n`;

    ctx.reply(statsMessage, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    ctx.reply('❌ Failed to load admin stats.');
  }
});

bot.command('help', (ctx) => {
  ctx.reply(
    `🆘 *How to Use ShibaRocketBot*\n\n` +
    `🪙 *Earn $SHROCK Tokens:*\n` +
    `- Type /task to view available social tasks (e.g. Follow, Retweet)\n` +
    `- Complete the task and submit proof (username or screenshot)\n\n` +
    `📌 *Commands You Can Use:*\n` +
    `/task – See available tasks\n` +
    `/submit – Submit your username\n` +
    `/claim – Claim your daily SHROCK reward\n` +
    `/balance – Check your token balance\n` +
    `/withdraw – Send your SHROCK to your wallet\n` +
    `/referral – Get your referral link\n` +
    `/stats – View your progress\n` +
    `/getid – View your Telegram ID\n\n` +
    `📣 *Support & Community:*\nJoin our Telegram: @ShibaRocketPack`,
    { parse_mode: 'Markdown' }
  );
});

bot.telegram.setMyCommands([
  // 🧑‍🚀 User Commands
  { command: 'start', description: 'Start & Register' },
  { command: 'task', description: 'View available tasks' },
  { command: 'claim', description: 'Daily SHROCK reward' },
  { command: 'balance', description: 'Check your SHROCK balance' },
  { command: 'referral', description: 'Get your referral link' },
  { command: 'streak', description: 'View your claim streak' },
  { command: 'submit', description: 'Submit social usernames' },
  { command: 'withdraw', description: 'Withdraw your SHROCK' },
  { command: 'getid', description: 'Show this chat ID' },
  { command: 'stats', description: 'View your progress' },
  { command: 'help', description: 'How to earn and use commands' },

  // 🧑‍💻 Admin Tools (will still require ID check)
  { command: 'leaderboard', description: 'View top earners' },
  { command: 'walletbalance', description: 'Bot wallet SHROCK balance (admin)' },
  { command: 'completetask', description: 'Mark task completed (admin)' },
  { command: 'addtask', description: 'Add task (admin)' },
  { command: 'adminstats', description: 'View bot performance stats (admin)' },
  { command: 'removetask', description: 'Remove task (admin)' },
  { command: 'admin', description: 'Show admin tools' }
]);

bot.on('text', async (ctx) => {
  const userId = ctx.from.id.toString();
  const message = ctx.message.text.trim();

  if (!/^\d+$/.test(message)) return; // Only handle numbers

  const selectedIndex = parseInt(message);
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) return;

  const { taskOptions } = userDoc.data();
  if (!taskOptions || !Array.isArray(taskOptions)) return;

  const selectedTask = taskOptions.find(task => task.index === selectedIndex);
  if (!selectedTask) {
    ctx.reply('❗ Invalid task number. Please use /task again to see options.');
    return;
  }

  // Save full activeTask including 'requires'
  await userRef.set({
    activeTask: {
      taskId: selectedTask.id,
      taskName: selectedTask.name,
      requires: selectedTask.requires || 'username' // fallback
    }
  }, { merge: true });

  const escapeMarkdown = (text) => {
    return text.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
  };

  const safeTaskName = escapeMarkdown(selectedTask.name);

  let submissionNote = '';
  if (selectedTask.requires === 'username') {
    submissionNote = '📌 Please submit your username (e.g. /submit Twitter your_handle)';
  } else if (selectedTask.requires === 'screenshot') {
    submissionNote = '🖼️ Please upload a screenshot for verification.';
  } else if (selectedTask.requires === 'both') {
    submissionNote = '📌 Submit your username (e.g. /submit Twitter your_handle)\n🖼️ And upload a screenshot for verification.';
  } else {
    submissionNote = '📌 Please submit proof as required.';
  }

  ctx.reply(
    `✅ You selected: *${safeTaskName}*\n\n${escapeMarkdown(submissionNote)}`,
    { parse_mode: 'Markdown' }
  );
});

bot.on('photo', async (ctx) => {
  const userId = ctx.from.id.toString();
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) return;

  const user = userDoc.data();
  const activeTask = user.activeTask;

  if (!activeTask) {
    ctx.reply('⚠️ Please select a task first using /task.');
    return;
  }

  const photoArray = ctx.message.photo;
  const fileId = photoArray[photoArray.length - 1].file_id; // Best quality

  // ✅ Notify user
  ctx.reply(`✅ Screenshot received for: *${activeTask.taskName}*\n\nAn admin will verify your submission soon.`, {
    parse_mode: 'Markdown'
  });

  // 📩 Notify all admins
  const adminsSnapshot = await db.collection('admins').get();
  adminsSnapshot.forEach(doc => {
    const adminId = doc.id;
    bot.telegram.sendPhoto(adminId, fileId, {
      caption: `📷 Screenshot submitted by user ID ${userId}\n📝 Task: ${activeTask.taskName}`
    });
  });

  // 💾 Log submission in subcollection
  await userRef.collection('submissions').doc(activeTask.taskId).set({
    type: 'screenshot',
    fileId,
    taskName: activeTask.taskName,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  // Optional: Automatically mark task as submitted
  await userRef.set({
    completedTasks: admin.firestore.FieldValue.arrayUnion(activeTask.taskId)
  }, { merge: true });
});

// Launch the bot
bot.launch();

// 🔔 Daily Reminder to All Users to Claim
const sendDailyReminder = async () => {
  const now = moment();
  const snapshot = await db.collection('users').get();

  snapshot.forEach(async (doc) => {
    const chatId = doc.id;
    const user = doc.data();
    const lastSent = user.lastDailyReminderSent ? moment(user.lastDailyReminderSent.toDate?.() || user.lastDailyReminderSent) : null;

    if (!lastSent || now.diff(lastSent, 'hours') >= 24) {
      await bot.telegram.sendMessage(chatId, '🌞 Don’t forget to claim your daily $SHROCK! Type /claim');
      await db.collection('users').doc(chatId).update({
        lastDailyReminderSent: new Date()
      });
    }
  });
};

// Call every 24 hours
setInterval(sendDailyReminder, 24 * 60 * 60 * 1000);
