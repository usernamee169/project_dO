const axios = require('axios');
const cheerio = require('cheerio');

async function testTopTradeSearch() {
    const searchUrl = 'https://topdeck.ru/apps/toptrade/singles/search?q=sol+ring';
    
    try {
        console.log('Fetching:', searchUrl);
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        console.log('Page title:', $('title').text());
        console.log('Content length:', response.data.length);
        
        // Сохраняем HTML для анализа
        const fs = require('fs');
        fs.writeFileSync('debug-search.html', response.data);
        console.log('Saved HTML to debug-search.html');
        
        // Ищем любые упоминания цен
        const priceMatches = response.data.match(/\d{1,3}(?:[ ,]\d{3})*\s*₽/g);
        if (priceMatches) {
            console.log('Found prices:', priceMatches.slice(0, 10));
        }
        
        // Ищем ссылки на товары
        const itemLinks = [];
        $('a[href*="/store/items/"]').each((i, el) => {
            itemLinks.push($(el).attr('href'));
        });
        console.log('Found item links:', itemLinks);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function testForumTopic() {
    const topicUrl = 'https://topdeck.ru/forums/topic/583258-%D0%BF%D1%80%D0%BE%D0%B4%D0%B0%D0%BC-%D0%BA%D0%B0%D1%80%D1%82%D1%8B-%D1%81%D0%B0%D0%BC%D0%B0%D1%80%D0%B0/';
    
    try {
        console.log('\nFetching forum topic:', topicUrl);
        const response = await axios.get(topicUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Сохраняем HTML для анализа
        const fs = require('fs');
        fs.writeFileSync('debug-forum.html', response.data);
        console.log('Saved forum HTML to debug-forum.html');
        
        // Ищем все посты
        const posts = $('.cPost');
        console.log('Found posts:', posts.length);
        
        // Ищем текст с ценами
        const text = $('body').text();
        const priceLines = [];
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.match(/\d{3,}\s*[рруб₽]/) && line.includes('-')) {
                priceLines.push(line.trim());
            }
        }
        console.log('Price lines found:', priceLines.slice(0, 5));
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function testDirectItem() {
    const itemUrl = 'https://topdeck.ru/apps/toptrade/store/items/10204';
    
    try {
        console.log('\nFetching direct item:', itemUrl);
        const response = await axios.get(itemUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        
        // Ищем цену
        const priceText = $('.label.label-default').first().text();
        console.log('Price from label:', priceText);
        
        // Ищем цену в других местах
        $('.row').each((i, row) => {
            const text = $(row).text();
            if (text.includes('Цена') || text.includes('Price')) {
                console.log('Price row:', text);
            }
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

// Запуск всех тестов
async function runTests() {
    await testTopTradeSearch();
    await testForumTopic();
    await testDirectItem();
}

runTests();