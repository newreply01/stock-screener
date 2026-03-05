const axios = require('axios');

async function testTWSE() {
    try {
        const url = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_2330.tw';
        const res = await axios.get(url);
        const data = res.data;
        if (data && data.msgArray && data.msgArray.length > 0) {
            const info = data.msgArray[0];
            console.log("TWSE Raw Info:", info);
            console.log("y (yesterday close):", info.y);
        } else {
            console.log("No data returned:", data);
        }
    } catch (e) {
        console.error("Error formatting:", e.message);
    }
}
testTWSE();
