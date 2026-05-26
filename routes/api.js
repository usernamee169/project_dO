const express = require('express');
const router = express.Router();
const { getOffersForCard } = require('../scrapers');

router.post('/search', async (req, res) => {
    try {
        const { cards } = req.body;
        
        if (!cards || !Array.isArray(cards) || cards.length === 0) {
            return res.status(400).json({ error: 'Invalid cards list' });
        }
        
        const results = [];
        let foundCount = 0;
        let totalMinSum = 0;
        
        for (const cardName of cards) {
            const offers = await getOffersForCard(cardName);
            let minPrice = null;
            if (offers.length > 0) {
                minPrice = Math.min(...offers.map(o => o.price));
                totalMinSum += minPrice;
                foundCount++;
            }
            results.push({
                name: cardName,
                offers: offers,
                minPrice: minPrice
            });
        }
        
        res.json({
            results,
            foundCount,
            totalCards: cards.length,
            notFoundCount: cards.length - foundCount,
            totalMinSum
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;