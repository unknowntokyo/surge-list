/*
 * 设置所有格式为 "Instagram-regular"
 * #type=Instagram-regular
 */

function operator(proxies) {
    const { type, num } = $arguments;

    const TABLE = {
        "Instagram-regular": ["𝟬","𝟭","𝟮","𝟯","𝟰","𝟱","𝟲","𝟳","𝟴","𝟵","𝗔","𝗕","𝗖","𝗗","𝗘","𝗙","𝗚","𝗛","𝗜","𝗝","𝗞","𝗟","𝗠","𝗡","𝗢","𝗣","𝗤","𝗥","𝗦","𝗧","𝗨","𝗩","𝗪","𝗫","𝗬","𝗭"],
    };

    const INDEX = { "48": 0, "49": 1, "50": 2, "51": 3, "52": 4, "53": 5, "54": 6, "55": 7, "56": 8, "57": 9, "65": 36, "66": 37, "67": 38, "68": 39, "69": 40, "70": 41, "71": 42, "72": 43, "73": 44, "74": 45, "75": 46, "76": 47, "77": 48, "78": 49, "79": 50, "80": 51, "81": 52, "82": 53, "83": 54, "84": 55, "85": 56, "86": 57, "87": 58, "88": 59, "89": 60, "90": 61 };

    return proxies.map(p => {
        const { name } = p;
        const newName = [];
        for (let i = 0; i < name.length; i++) {
            const code = name.charCodeAt(i);
            if (code < 48 || code > 123) {
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