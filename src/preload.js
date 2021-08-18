const config = require("./config");
const fetch = require('node-fetch');
const {exec} = require("child_process");
const emojiUnicode = require("emoji-unicode")

let input = ""  // setting 时，记录用户输入的值


function isEmojiCharacter(substring) {
    for ( let i = 0; i < substring.length; i++) {
        let hs = substring.charCodeAt(i);
        if (0xd800 <= hs && hs <= 0xdbff) {
            if (substring.length > 1) {
                const ls = substring.charCodeAt(i + 1);
                const uc = ((hs - 0xd800) * 0x400) + (ls - 0xdc00) + 0x10000;
                if (0x1d000 <= uc && uc <= 0x1f77f) {
                    return true;
                }
            }
        } else if (substring.length > 1) {
            const ls = substring.charCodeAt(i + 1);
            if (ls === 0x20e3) {
                return true;
            }
        } else {
            if (0x2100 <= hs && hs <= 0x27ff) {
                return true;
            } else if (0x2B05 <= hs && hs <= 0x2b07) {
                return true;
            } else if (0x2934 <= hs && hs <= 0x2935) {
                return true;
            } else if (0x3297 <= hs && hs <= 0x3299) {
                return true;
            } else if (hs === 0xa9 || hs === 0xae || hs === 0x303d || hs === 0x3030
                || hs === 0x2b55 || hs === 0x2b1c || hs === 0x2b1b
                || hs === 0x2b50) {
                return true;
            }
        }
    }
}


function getTitle(recordMap, id) {
    let icon = "icon.png"
    const value = recordMap.block[id].value.value
    const collection_id = value.collection_id
    if (collection_id) {
        const collectionValue = recordMap.collection[value.collection_id].value.value
        const title = collectionValue.name[0][0]
        icon = collectionValue.icon
        if (isEmojiCharacter(icon)) {
            icon = "emojiicons/" + emojiUnicode(icon) + ".png"
        }
        return [title, icon];
    }
    const parent_id = value.parent_id
    if (parent_id && value.type === "page") {
        const title = value.properties.title[0][0]
        if (value.format && value.format.page_icon) {
            const page_icon = value.format.page_icon
            if (isEmojiCharacter(page_icon)) {
                icon = "emojiicons/" + emojiUnicode(page_icon) + ".png"
            }
        }
        return [title, icon];
    }
    return getTitle(recordMap, value.parent_id)
}


async function search(searchWord) {
    const searchResult = []
    const cookie = utools.dbStorage.getItem("cookie")
    const spaceId = utools.dbStorage.getItem("spaceId")
    // console.time('test2')
    const response = await fetch("https://www.notion.so/api/v3/search", {
        "headers": {
            "accept": "*/*",
            "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,zh-TW;q=0.7",
            "content-type": "application/json",
            "notion-client-version": "23.9.0.36",
            "sec-ch-ua": "\" Not A;Brand\";v=\"99\", \"Chromium\";v=\"90\", \"Google Chrome\";v=\"90\"",
            "sec-ch-ua-mobile": "?0",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
            "x-notion-active-user-header": "5071bdc3-8e9f-4ced-9e43-ea5909735a72",
            "cookie": cookie
        },
        "body": "{\"type\":\"BlocksInSpace\",\"query\":\"" + searchWord + "\",\"spaceId\":\"" + spaceId + "\",\"limit\":9,\"filters\":{\"isDeletedOnly\":false,\"excludeTemplates\":false,\"isNavigableOnly\":false,\"requireEditPermissions\":false,\"ancestors\":[],\"createdBy\":[],\"editedBy\":[],\"lastEditedTime\":{},\"createdTime\":{}},\"sort\":\"Relevance\",\"source\":\"quick_find\"}",
        "method": "POST",
        "mode": "cors"
    });
    let jsonData = await response.json()
    // console.timeEnd('test2')
    const results = jsonData.results
    const recordMap = jsonData.recordMap
    const useDesktopClient = utools.dbStorage.getItem("useDesktopClient")
    let link = useDesktopClient === "true" ? "notion://www.notion.so/" : "https://www.notion.so/"

    for (let i = 0; i <= results.length; i++) {
        const item = results[i]
        let obj = {
            "title": "",
            "description": "",
            "icon": "icon.png",
            "parent_id": "",
            "link": "",
            "id": ""
        }

        if (item === undefined) {
            continue
        }

        obj.id = item.id
        obj.link = link + obj.id.replaceAll("-", "")

        // description
        if (item.highlight) {
            if (item.highlight.pathText) {
                obj.description = item.highlight.pathText.replaceAll("<gzkNfoUU>", "").replaceAll("</gzkNfoUU>", "")
            } else if (item.highlight.text) {
                obj.description = item.highlight.text.replaceAll("<gzkNfoUU>", "").replaceAll("</gzkNfoUU>", "")
            }
        }

        // title（第一个 type 为 page 的对象）
        try {
            [obj.title, obj.icon] = getTitle(recordMap, obj.id)
        } catch (e) {
            console.log(e)
        }

        searchResult.push(obj)
    }
    // console.log(searchResult, "///")
    return searchResult
}


let NSet = {
    mode: "list",
    args: {
        enter: (action, callbackSetList) => {
            // 读取数据库的值，没有则返回默认值
            const cookie = utools.dbStorage.getItem("cookie")
            if (cookie && cookie.length) {
                config.configs[0].description = cookie
            }
            const spaceId = utools.dbStorage.getItem("spaceId")
            if (spaceId && spaceId.length) {
                config.configs[1].description = spaceId
            }
            const useDesktopClient = utools.dbStorage.getItem("useDesktopClient")
            if (useDesktopClient && useDesktopClient.length) {
                config.configs[2].description = useDesktopClient
            }
            const notionPathWin = utools.dbStorage.getItem("notionPathWin")
            if (notionPathWin && notionPathWin.length) {
                config.configs[3].description = notionPathWin
            }

            callbackSetList(config.configs);
        },

        search: (action, searchWord, callbackSetList) => {
            input = searchWord
            callbackSetList(config.configs);
        },

        select: (action, itemData) => {
            // 记录搜索框的值到指定的选择项
            if (!input) return;
            utools.dbStorage.setItem(itemData.title, input) // 记录到数据库
            utools.showNotification(itemData.title + "设置成功！");

            utools.outPlugin();     // 关闭插件
            utools.hideMainWindow();    // 隐藏 uTools 窗口
        },
    },
};


let NS = {
    mode: "list",
    args: {
        enter: async (action, callbackSetList) => {
            callbackSetList([]);
        },

        search: async (action, searchWord, callbackSetList) => {
            if (!searchWord) return callbackSetList([]);

            callbackSetList([
                {
                    "title": searchWord,
                    "description": "在 Notion 中搜索" + searchWord,
                    "icon": "logo.png"
                }
            ]);
        },

        select: async (action, itemData, callbackSetList) => {
            if (itemData.icon === "logo.png") { // 搜索
                callbackSetList([]);
                // console.time('test1')
                const searchResult = await search(itemData.title)
                // console.timeEnd('test1')
                callbackSetList(searchResult);
                return;
            }

            // 打开页面
            utools.hideMainWindow();    // 隐藏 uTools 窗口
            let command = ""
            if (utools.isMacOs()) {
                command = `open ${itemData.link}`;
            } else if (utools.isWindows()) {
                const useDesktopClient = utools.dbStorage.getItem("useDesktopClient")
                if (useDesktopClient === undefined || useDesktopClient === "flase") {    // 没有配置使用桌面app
                    command = `start ${itemData.link}`;
                } else {
                    const notionPathWin = utools.dbStorage.getItem("notionPathWin")
                    if (!notionPathWin) {
                        utools.showNotification("Notion 应用路径未配置");
                        utools.outPlugin();     // 关闭插件
                    } else {
                        command = `${notionPathWin} ${itemData.link}`
                    }
                }
            }

            if (command) {
                exec(command, function (err, stdout , stderr) {
                    if (err) utools.showNotification(err);
                    utools.outPlugin();     // 关闭插件
                });
            }
        },
    },
};


/**
 * 导出
 */
window.exports = {
    NSet,
    NS
};
