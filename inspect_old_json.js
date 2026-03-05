const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/home/xg/stock-screener/mi_index_20260226.json'));
j.tables.forEach((t, i) => {
    const taiex = t.data && t.data.find(r => r[0] && r[0].includes('發行量加權股價指數'));
    if (taiex) {
        console.log('Index:', i, 'Title:', t.title, 'Value:', taiex[1]);
    }
});
