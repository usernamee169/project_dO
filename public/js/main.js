document.getElementById('searchBtn').addEventListener('click', () => {
    const cardListText = document.getElementById('cardList').value;
    
    let cards = cardListText.split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    
    if (cards.length === 0) {
        alert('Пожалуйста, введите хотя бы одну карту (каждую с новой строки)');
        return;
    }
    
    localStorage.setItem('searchCards', JSON.stringify(cards));
    window.location.href = '/results.html';
});