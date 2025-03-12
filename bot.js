const TelegramBot = require('node-telegram-bot-api');
const { fetchGifts } = require('./giftFilter');
require('dotenv').config();

// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Хранилище для отслеживания уже отправленных подарков и настроек
const sentGifts = new Set();
const userSettings = new Map();
const monitoringIntervals = new Map();

// Значения по умолчанию
const DEFAULT_MAX_PRICE = 4;

// Функция для отправки сообщения о подарке
async function sendGiftAlert(chatId, gift) {
    const message = `🎁 Новый подарок!\n\n` +
        `📦 Название: ${gift.name}\n` +
        `🏷 Модель: ${gift.model}\n` +
        `🔢 Номер: ${gift.gift_num}\n` +
        `🎨 Фон: ${gift.backdrop}\n` +
        `💎 Цена: ${gift.price} TON`;

    const options = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{
                    text: '🎁 Купить подарок',
                    url: `https://t.me/tonnel_network_bot/gift?startapp=${gift.gift_id}`
                }]
            ]
        }
    };

    try {
        await bot.sendMessage(chatId, message, options);
    } catch (error) {
        console.error("Ошибка при отправке сообщения:", error);
    }
}

// Обработчик команды /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`👤 Получена команда /start от пользователя ${msg.from.username || msg.from.id} в чате ${chatId}`);
    
    // Устанавливаем настройки по умолчанию, если их нет
    if (!userSettings.has(chatId)) {
        console.log(`⚙️ Установка настроек по умолчанию для чата ${chatId}`);
        userSettings.set(chatId, {
            maxPrice: DEFAULT_MAX_PRICE
        });
    }

    const settings = userSettings.get(chatId);
    await bot.sendMessage(
        chatId, 
        `🤖 Бот запущен!\n\n` +
        `📊 Текущие настройки:\n` +
        `💰 Максимальная цена: ${settings.maxPrice} TON\n\n` +
        `Команды:\n` +
        `/price <цена> - установить максимальную цену\n` +
        `/stop - остановить мониторинг`
    );
    
    startMonitoring(chatId);
});

// Обработчик команды /stop
bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    console.log(`🛑 Получена команда /stop от пользователя ${msg.from.username || msg.from.id} в чате ${chatId}`);
    
    if (monitoringIntervals.has(chatId)) {
        clearInterval(monitoringIntervals.get(chatId));
        monitoringIntervals.delete(chatId);
        console.log(`⏹ Мониторинг остановлен для чата ${chatId}`);
        await bot.sendMessage(chatId, '🛑 Мониторинг остановлен');
    } else {
        console.log(`ℹ️ Попытка остановки неактивного мониторинга в чате ${chatId}`);
        await bot.sendMessage(chatId, '❌ Мониторинг уже остановлен');
    }
});

// Обработчик команды /price
bot.onText(/\/price(?:\s+(\d*\.?\d*))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const newPrice = match[1];

    if (!newPrice) {
        const currentPrice = userSettings.get(chatId)?.maxPrice || DEFAULT_MAX_PRICE;
        await bot.sendMessage(
            chatId, 
            `📊 Текущая максимальная цена: ${currentPrice} TON\n\n` +
            `Чтобы изменить цену, используйте команду:\n` +
            `/price <новая цена>`
        );
        return;
    }

    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) {
        await bot.sendMessage(chatId, '❌ Пожалуйста, укажите корректную цену больше 0');
        return;
    }

    userSettings.set(chatId, {
        ...userSettings.get(chatId),
        maxPrice: price
    });

    await bot.sendMessage(
        chatId, 
        `✅ Максимальная цена установлена: ${price} TON\n\n` +
        `Теперь вы будете получать уведомления о подарках дешевле ${price} TON`
    );

    // Перезапускаем мониторинг с новыми настройками
    if (monitoringIntervals.has(chatId)) {
        clearInterval(monitoringIntervals.get(chatId));
        startMonitoring(chatId);
    }
});

// Функция мониторинга подарков
async function startMonitoring(chatId) {
    console.log(`🟢 Запуск мониторинга для чата ${chatId}`);
    
    // Очищаем предыдущий интервал, если он существует
    if (monitoringIntervals.has(chatId)) {
        console.log(`🔄 Перезапуск существующего мониторинга для чата ${chatId}`);
        clearInterval(monitoringIntervals.get(chatId));
    }

    const interval = setInterval(async () => {
        try {
            console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Начало цикла мониторинга для чата ${chatId}`);
            
            const gifts = await fetchGifts();
            const settings = userSettings.get(chatId);
            const maxPrice = settings?.maxPrice || DEFAULT_MAX_PRICE;
            
            console.log(`📊 Статистика:
            - Всего подарков получено: ${gifts.length}
            - Максимальная цена поиска: ${maxPrice} TON
            - Размер кэша отправленных ID: ${sentGifts.size}`);
            
            const filteredGifts = gifts.filter(gift => gift.price < maxPrice);
            console.log(`🎯 Найдено ${filteredGifts.length} подарков дешевле ${maxPrice} TON`);
            
            let newGiftsCount = 0;
            for (const gift of filteredGifts) {
                if (!sentGifts.has(gift.gift_id)) {
                    console.log(`✨ Новый подарок:
                    - ID: ${gift.gift_id}
                    - Модель: ${gift.model}
                    - Цена: ${gift.price} TON`);
                    
                    await sendGiftAlert(chatId, gift);
                    sentGifts.add(gift.gift_id);
                    newGiftsCount++;
                }
            }
            
            console.log(`📫 Отправлено новых уведомлений: ${newGiftsCount}`);

            // Очищаем старые gift_id каждые 24 часа
            if (sentGifts.size > 1000) {
                console.log('🧹 Очистка кэша отправленных ID');
                sentGifts.clear();
            }
            
            console.log(`✅ Цикл мониторинга завершен\n`);
        } catch (error) {
            console.error("❌ Ошибка в цикле мониторинга:", error);
        }
    }, 20000); // Интервал 20 секунд

    monitoringIntervals.set(chatId, interval);
    console.log(`📡 Мониторинг успешно запущен для чата ${chatId}`);
}

// Обработка ошибок
bot.on('polling_error', (error) => {
    console.error(error);
});

console.log('Бот запущен!'); 