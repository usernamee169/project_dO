let searchResults = [];
let cart = [];

function loadCart() {
    const savedCart = localStorage.getItem('mtgCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    } else {
        cart = [];
    }
    updateCartUI();
}

function saveCart() {
    localStorage.setItem('mtgCart', JSON.stringify(cart));
    updateCartUI();
}

function addToCart(cardName, seller, price, url) {
    const existingIndex = cart.findIndex(item => item.cardName === cardName);
    if (existingIndex !== -1) {
        cart[existingIndex] = { cardName, seller, price, url };
    } else {
        cart.push({ cardName, seller, price, url });
    }
    saveCart();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
}

function clearCart() {
    cart = [];
    saveCart();
}

function updateCartUI() {
    const cartItemsDiv = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');
    
    if (cart.length === 0) {
        cartItemsDiv.innerHTML = '<p class="empty-cart">Корзина пуста</p>';
        cartCount.textContent = '0';
        cartTotal.textContent = '0';
        document.getElementById('totalCartCards').textContent = searchResults.length || '0';
        return;
    }
    
    let total = 0;
    let html = '';
    cart.forEach((item, index) => {
        total += item.price;
        html += `
            <div class="cart-item">
                <h4>${escapeHtml(item.cardName)}</h4>
                <div class="seller">${escapeHtml(item.seller)}</div>
                <div class="price">${item.price.toLocaleString()} ₽</div>
                <div class="cart-item-actions">
                    <a href="${escapeHtml(item.url)}" target="_blank" class="cart-item-link">Купить →</a>
                    <button class="btn-danger" onclick="removeFromCart(${index})">Удалить</button>
                </div>
            </div>
        `;
    });
    
    cartItemsDiv.innerHTML = html;
    cartCount.textContent = cart.length;
    cartTotal.textContent = total.toLocaleString();
    document.getElementById('totalCartCards').textContent = searchResults.length || '0';
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function renderResults(results, allSellers) {
    const tbody = document.getElementById('tableBody');
    const thead = document.getElementById('tableHeader');
    
    let headerHtml = '<th>Название карты</th><th>Мин</th>';
    allSellers.forEach(seller => {
        headerHtml += `<th>${escapeHtml(seller)}</th>`;
    });
    thead.innerHTML = headerHtml;
    
    const sellerCardCount = {};
    allSellers.forEach(seller => { sellerCardCount[seller] = 0; });
    
    results.forEach(card => {
        const uniqueSellers = new Set(card.offers.map(o => o.seller));
        uniqueSellers.forEach(seller => {
            if (sellerCardCount.hasOwnProperty(seller)) sellerCardCount[seller]++;
        });
    });
    
    let rowsHtml = '';
    results.forEach(card => {
        const minPrice = card.minPrice ? card.minPrice.toLocaleString() : '—';
        const offerMap = {};
        card.offers.forEach(offer => { offerMap[offer.seller] = offer; });
        
        rowsHtml += '<tr>';
        rowsHtml += `<td><strong>${escapeHtml(card.name)}</strong></td>`;
        rowsHtml += `<td class="min-price">${minPrice} ₽</td>`;
        
        allSellers.forEach(seller => {
            const offer = offerMap[seller];
            if (offer) {
                const highlightClass = sellerCardCount[seller] >= 2 ? 'seller-highlight' : '';
                rowsHtml += `<td class="price-cell ${highlightClass}">
                                <span class="price-value">${offer.price.toLocaleString()} ₽</span>
                                <button class="add-to-cart-btn" onclick="addToCart('${escapeHtml(card.name)}', '${escapeHtml(seller)}', ${offer.price}, '${escapeHtml(offer.url)}')">Выбрать</button>
                                <a href="${escapeHtml(offer.url)}" target="_blank" class="price-link">🔗</a>
                             </td>`;
            } else {
                rowsHtml += `<td class="price-cell">—</td>`;
            }
        });
        rowsHtml += '</tr>';
    });
    tbody.innerHTML = rowsHtml;
}

async function loadResults() {
    const cardsJson = localStorage.getItem('searchCards');
    if (!cardsJson) {
        alert('Список карт не найден. Вернитесь на главную страницу.');
        window.location.href = '/';
        return;
    }
    const cards = JSON.parse(cardsJson);
    try {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cards })
        });
        const data = await response.json();
        if (data.error) {
            alert('Ошибка: ' + data.error);
            return;
        }
        searchResults = data.results;
        document.getElementById('foundCount').textContent = data.foundCount;
        document.getElementById('totalCards').textContent = data.totalCards;
        document.getElementById('totalSum').textContent = data.totalMinSum.toLocaleString() + ' ₽';
        const notFound = data.results.filter(r => r.offers.length === 0).map(r => r.name);
        document.getElementById('notFoundList').textContent = notFound.length ? notFound.join(', ') : 'Все карты найдены';
        
        const allSellersSet = new Set();
        data.results.forEach(card => {
            card.offers.forEach(offer => { allSellersSet.add(offer.seller); });
        });
        const allSellers = Array.from(allSellersSet).sort();
        renderResults(data.results, allSellers);
        document.getElementById('totalCartCards').textContent = data.totalCards;
    } catch (error) {
        console.error('Error loading results:', error);
        alert('Ошибка при загрузке результатов: ' + error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    loadResults();
    document.getElementById('clearCartBtn').addEventListener('click', () => {
        if (confirm('Очистить всю корзину?')) clearCart();
    });
});