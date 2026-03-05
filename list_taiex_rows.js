const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/home/xg/stock-screener/mi_index_full.json'));
j.tables.forEach((t, i) => {
    if (!t.data) return;
    const r = t.data.find(row => row[0] && row[0].includes('發行量加權股價指數'));
    if (r) {
        console.log('Table Index:', i);
        console.log('Table Title:', t.title);
        console.log('Row Data:', JSON.stringify(r));
        console.log('---');
    }
});
