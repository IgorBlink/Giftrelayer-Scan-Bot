const myHeaders = new Headers();
myHeaders.append("Content-Type", "application/json");

async function fetchGifts() {
    console.log('🔄 Начинаем запрос подарков...');
    
    const raw = JSON.stringify({
        "page": 1,
        "limit": 30,
        "sort": "{\"price\":1,\"gift_id\":-1}",
        "filter": "{\"price\":{\"$exists\":true},\"refunded\":{\"$ne\":true},\"buyer\":{\"$exists\":false},\"export_at\":{\"$exists\":true},\"backdrop\":{\"$regex\":\"^Black \\\\(\"},\"asset\":\"TON\"}",
        "ref": 0,
        "price_range": null,
        "user_auth": process.env.USER_AUTH
    });

    const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: raw,
        redirect: "follow"
    };

    try {
        console.log('📡 Отправка запроса к API...');
        console.log('🔍 Параметры запроса:', {
            url: "https://gifts2.tonnel.network/api/pageGifts",
            method: requestOptions.method,
            headers: Object.fromEntries(myHeaders.entries())
        });

        const response = await fetch("https://gifts2.tonnel.network/api/pageGifts", requestOptions);
        console.log(`📥 Получен ответ от сервера. Статус: ${response.status}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log(`✅ Успешно получены данные. Всего подарков: ${result.length}`);

        const filteredGifts = result.filter(gift => gift.price < 4);
        console.log(`🎯 Найдено ${filteredGifts.length} подарков с ценой < 4 TON`);
        
        if (filteredGifts.length > 0) {
            console.log('💝 Найденные подарки:');
            filteredGifts.forEach(gift => {
                console.log(`   - ID: ${gift.gift_id}, Цена: ${gift.price} TON, Модель: ${gift.model}`);
            });
        }

        return filteredGifts;
    } catch (error) {
        console.error("❌ Ошибка при получении подарков:", error);
        if (error.response) {
            console.error("📄 Тело ответа:", await error.response.text());
        }
        return [];
    }
}

// Экспортируем функцию для использования в боте
module.exports = { fetchGifts };

// Если файл запущен напрямую, выполняем тестовый запрос
if (require.main === module) {
    console.log('🚀 Запуск тестового запроса...');
    fetchGifts().then(gifts => {
        if (gifts.length > 0) {
            console.log("\n📦 Подарки с ценой меньше 4 TON:");
            gifts.forEach(gift => {
                console.log(`
                🆔 ID: ${gift.gift_id}
                📝 Название: ${gift.name}
                🎭 Модель: ${gift.model}
                🔢 Номер подарка: ${gift.gift_num}
                🎨 Фон: ${gift.backdrop}
                💰 Цена: ${gift.price} TON
                ----------------------`);
            });
        } else {
            console.log('😔 Подходящих подарков не найдено');
        }
    });
} 