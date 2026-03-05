const fs = require('fs');
const j = JSON.parse(fs.readFileSync('/home/xg/stock-screener/mi_index_20260226.json'));
j.tables.forEach((t, i) => {
    console.log('Index:', i, 'Title:', t.title);
    if (t.data && t.data.length > 0) {
        console.table(t.data.slice(0, 5));
    }
});
