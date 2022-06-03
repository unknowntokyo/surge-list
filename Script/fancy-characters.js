/*
 * 设置所有格式为 "Instagram-regular"
 * #type=Instagram-regular
 */

function operator(proxies) {
    const { type, num } = $arguments;

    const TABLE = {
        "Instagram-regular": ["𝟬","𝟭","𝟮","𝟯","𝟰","𝟱","𝟲","𝟳","𝟴","𝟵","𝗔","𝗕","𝗖","𝗗","𝗘","𝗙","𝗚","𝗛","𝗜","𝗝","𝗞","𝗟","𝗠","𝗡","𝗢","𝗣","𝗤","𝗥","𝗦","𝗧","𝗨","𝗩","𝗪","𝗫","𝗬","𝗭"],
    };

    const INDEX = { "48": 0, "49": 1, "50": 2, "51": 3, "52": 4, "53": 5, "54": 6, "55": 7, "56": 8, "57": 9, "65": 10, "66": 11, "67": 12, "68": 13, "69": 14, "70": 15, "71": 16, "72": 17, "73": 18, "74": 19, "75": 20, "76": 21, "77": 22, "78": 23, "79": 24, "80": 25, "81": 26, "82": 27, "83": 28, "84": 29, "85": 30, "86": 31, "87": 32, "88": 33, "89": 34, "90": 35 };

    return proxies.map(p => {
        const { name } = p;
        const newName = [];
        for (let i = 0; i < name.length; i++) {
            const code = name.charCodeAt(i);
            if (code < 48 || code > 91 || name[i].length >= 2) {
                newName.push(name[i]);
            };
            const index = INDEX[code];
            if (index !== undefined) {
                let char;
                if (isNumber(code) && num) {
                    char = TABLE[num][index];
                } else {
                    char = TABLE[type][index];
                }
                newName[i] = char;
            } else {
                newName.push(name[i]);
            }
        }
        p.name = newName.join('');
        return p;
    })
}

function isNumber(code) { return code >= 48 && code <= 57; }