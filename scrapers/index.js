const axios = require('axios');
const cheerio = require('cheerio');

async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
                    'Connection': 'keep-alive',
                },
                timeout: 10000,
                ...options
            });
            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`Retry attempt ${i+1}/${retries} for ${url}`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

function extractOffersFromScript(html, cardName) {
    const regex = /new SinglesSearchVM\(\s*JSON\.parse\(\s*"((?:\\"|[^"])*?)"\s*\)/s;
    const match = html.match(regex);
    if (!match) {
        console.log('Could not find SinglesSearchVM JSON in page');
        return [];
    }

    let jsonStr = match[1];
    jsonStr = jsonStr.replace(/\\"/g, '"');
    jsonStr = jsonStr.replace(/\\\\/g, '\\');
    jsonStr = jsonStr.replace(/\\\//g, '/');
    jsonStr = jsonStr.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

    try {
        const offersData = JSON.parse(jsonStr);
        if (!Array.isArray(offersData)) return [];

        const offers = [];
        const lowerCardName = cardName.toLowerCase();

        for (const item of offersData) {
            if (!item.cost || item.cost === 1 || !item.url) continue;
            const itemName = (item.name || item.rus_name || '').toLowerCase();
            if (!itemName.includes(lowerCardName)) continue;

            let seller = 'Продавец на TOPTrade';
            if (item.seller && typeof item.seller === 'object' && item.seller.name) {
                seller = item.seller.name;
            } else if (item.seller && typeof item.seller === 'string') {
                seller = item.seller;
            }

            const url = item.url.startsWith('http') ? item.url : `https://topdeck.ru${item.url}`;
            offers.push({ seller, price: item.cost, url });
        }
        return offers;
    } catch (error) {
        console.error('Error parsing JSON from script:', error.message);
        return [];
    }
}

async function scrapeTopTrade(cardName) {
    const searchUrl = `https://topdeck.ru/apps/toptrade/singles/search?q=${encodeURIComponent(cardName)}`;
    try {
        console.log(`Searching TOPTrade: ${cardName}`);
        const response = await fetchWithRetry(searchUrl);
        const offers = extractOffersFromScript(response.data, cardName);
        if (offers.length > 0) {
            console.log(`  Found ${offers.length} offers on TOPTrade`);
        } else {
            console.log(`  No offers found on TOPTrade`);
        }
        return offers;
    } catch (error) {
        console.error(`TOPTrade error for ${cardName}:`, error.message);
        return [];
    }
}

async function parseForumTopic(topicUrl, targetCardName) {
    console.log(`Parsing forum topic: ${topicUrl}`);
    try {
        const response = await fetchWithRetry(topicUrl);
        const $ = cheerio.load(response.data);
        const posts = $('.cPost_contentWrap .ipsType_richText');
        const offers = [];
        const searchWords = targetCardName.toLowerCase().split(/[\s,]+/).filter(word => word.length > 0);

        for (const post of posts) {
            const $post = $(post);
            const text = $post.text();
            const lines = text.split(/\r?\n/);
            let seller = $post.closest('.cPost').find('.cAuthorPane_author a').first().text().trim();
            if (!seller) seller = 'Forum seller';

            for (const line of lines) {
                const regex = /^(?:\d+[xх×]?\s*)?([^\-–—:0-9]+?)\s*[\-–—:]\s*(\d{1,3}(?:[ \d]{0,3})*)\s*[рруб₽]|^(?:\d+[xх×]?\s*)?([^0-9]+?)\s+(\d{1,3}(?:[ \d]{0,3})*)\s*[рруб₽]/i;
                const match = line.match(regex);
                if (match) {
                    let cardName = (match[1] || match[3] || '').trim().toLowerCase();
                    let priceStr = (match[2] || match[4] || '').replace(/\s/g, '');
                    let price = parseInt(priceStr, 10);
                    if (!isNaN(price) && cardName.length > 0) {
                        const allWordsMatch = searchWords.every(word => cardName.includes(word));
                        if (allWordsMatch) {
                            offers.push({ seller, price, url: topicUrl });
                            console.log(`  Found: "${cardName}" for ${price} RUB (seller: ${seller})`);
                        }
                    }
                }
            }
        }
        return offers;
    } catch (error) {
        console.error(`Error parsing forum topic ${topicUrl}:`, error.message);
        return [];
    }
}

async function searchForumTopics(cardName) {
    const forumSections = [
        'https://topdeck.ru/forums/forum/144-%D0%BF%D1%80%D0%BE%D0%B4%D0%B0%D0%B6%D0%B0-%D0%BA%D0%B0%D1%80%D1%82/',
        'https://topdeck.ru/forums/forum/145-%D0%BF%D0%BE%D0%BA%D1%83%D0%BF%D0%BA%D0%B0-%D0%B8-%D0%BE%D0%B1%D0%BC%D0%B5%D0%BD/'
    ];
    const searchWords = cardName.toLowerCase().split(/[\s,]+/).filter(word => word.length > 3);
    const foundTopics = [];

    for (const sectionUrl of forumSections) {
        try {
            console.log(`Searching forum section: ${sectionUrl}`);
            const response = await fetchWithRetry(sectionUrl);
            const $ = cheerio.load(response.data);
            const topics = $('.ipsDataItem');
            for (const topic of topics) {
                const $topic = $(topic);
                const title = $topic.find('.ipsDataItem_title').text().toLowerCase();
                const topicUrl = $topic.find('.ipsDataItem_title a').attr('href');
                if (topicUrl) {
                    const fullUrl = topicUrl.startsWith('http') ? topicUrl : `https://topdeck.ru${topicUrl}`;
                    const matches = searchWords.some(word => title.includes(word));
                    if (matches) {
                        foundTopics.push(fullUrl);
                        console.log(`Found potential topic: ${title.substring(0, 80)}...`);
                    }
                }
            }
            const searchUrl = `https://topdeck.ru/search/?q=${encodeURIComponent(cardName)}&type=forums_topic&search_in=titles`;
            const searchResponse = await fetchWithRetry(searchUrl);
            const $search = cheerio.load(searchResponse.data);
            const searchResults = $search('.ipsDataItem');
            searchResults.each((i, result) => {
                if (i >= 5) return;
                const $result = $(result);
                const title = $result.find('.ipsDataItem_title').text();
                const resultUrl = $result.find('.ipsDataItem_title a').attr('href');
                if (resultUrl && !foundTopics.includes(resultUrl)) {
                    const fullUrl = resultUrl.startsWith('http') ? resultUrl : `https://topdeck.ru${resultUrl}`;
                    foundTopics.push(fullUrl);
                    console.log(`Found via search: ${title.substring(0, 80)}...`);
                }
            });
        } catch (error) {
            console.error(`Error searching section ${sectionUrl}:`, error.message);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return [...new Set(foundTopics)];
}

async function getOffersForCard(cardName) {
    const allOffers = [];
    console.log(`\nSearching for card: "${cardName}"`);
    await new Promise(resolve => setTimeout(resolve, 500));
    const tradeOffers = await scrapeTopTrade(cardName);
    allOffers.push(...tradeOffers);
    console.log(`Searching forum topics for "${cardName}"...`);
    const forumTopics = await searchForumTopics(cardName);
    if (forumTopics.length === 0) {
        console.log(`No forum topics found`);
    } else {
        console.log(`Found ${forumTopics.length} topics`);
        for (const topicUrl of forumTopics) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const forumOffers = await parseForumTopic(topicUrl, cardName);
            allOffers.push(...forumOffers);
        }
    }
    const unique = [];
    const keyMap = new Set();
    for (const offer of allOffers) {
        const key = `${offer.seller}|${offer.price}|${offer.url}`;
        if (!keyMap.has(key)) {
            keyMap.add(key);
            unique.push(offer);
        }
    }
    unique.sort((a, b) => a.price - b.price);
    if (unique.length > 0) {
        console.log(`Best offer: ${unique[0].price} RUB from ${unique[0].seller}`);
    } else {
        console.log(`No offers found`);
    }
    return unique.length ? [unique[0]] : [];
}

module.exports = { getOffersForCard };