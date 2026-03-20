const BASE_URL = 'https://www.netflix.com/title/';
const BASE_URL_YTB = "https://www.youtube.com/premium";
const FILM_ID = 81280792

const link = { "media-url": "https://raw.githubusercontent.com/unknowntokyo/surge-list/master/X/unknown.png" } 
const policy_name = "Netflix" //填入你的 netflix 策略组名

const arrow = " ➟ "

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36'

// 即将登陆
const STATUS_COMING = 2
// 支持解锁
const STATUS_AVAILABLE = 1
// 不支持解锁
const STATUS_NOT_AVAILABLE = 0
// 检测超时
const STATUS_TIMEOUT = -1
// 检测异常
const STATUS_ERROR = -2

var opts = {
  policy: $environment.params
};

var opts1 = {
  policy: $environment.params,
  redirection: false
};

var CountryCode = new Map([["HK","HKG"],["JP","JPN"],["KR","KOR"],["SG","SGP"],["TW","TPE"],["US","USA"]])

let result = {
  "title": '        流媒体服务查询',
  "YouTube": '<b>YouTube:  </b>检测失败, 请重试 ❗️',
  "Netflix": '<b>Netflix:  </b>检测失败, 请重试 ❗️'
}
const message = {
  action: "get_policy_state",
  content: $environment.params
};

;(async () => {
  // 并行执行 Netflix 和 YouTube 检测
  await Promise.all([testNf(FILM_ID), testYTB()])
  console.log(result["Netflix"])

  let content = "-------------------------------------"+"</br>"+([result["YouTube"],result["Netflix"]]).join("</br></br>")
  content = content + "</br>-------------------------------------</br>"+"<font color=#007AFF>"+"<b>节点</b> ➟ " + $environment.params+ "</font>"
  content =`<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">` + content + `</p>`

  $configuration.sendMessage(message).then(resolve => {
    if (resolve.error) {
      console.log(resolve.error);
      $done()
    }
    if (resolve.ret) {
      let output=JSON.stringify(resolve.ret[message.content])? JSON.stringify(resolve.ret[message.content]).replace(/\"|\[|\]/g,"").replace(/\,/g," ➟ ") : $environment.params
      let content = "-------------------------------------</br>"+([result["Netflix"],result["YouTube"]]).join("</br></br>")
      content = content + "</br>-------------------------------------</br>"+"<font color=#007AFF>"+"<b>节点</b> ➟ " + output+ "</font>"
      content =`<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">` + content + `</p>`
      console.log(output);
      $done({"title":result["title"],"htmlMessage":content})
    }
  }, reject => {
    $done();
  });  
})();

function timeout(delay = 3000) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      reject('Timeout')
    }, delay)
  })
}

function testNf(filmId) {
  return new Promise((resolve, reject) =>{
    let option = {
      url: BASE_URL + filmId,
      opts: opts,
      timeout: 2800,
      headers: {
        'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
      },
    }
    $task.fetch(option).then(response => {
      console.log("nf:"+response.statusCode)
      if (response.statusCode === 404) {
        result["Netflix"] = "<b>Netflix: </b>支持自制剧集 ⚠️"
        console.log("nf:"+result["Netflix"])
        resolve('Not Found')
        return 
      } else if (response.statusCode === 403) {
        result["Netflix"] = "<b>Netflix: </b>未支持 🚫"
        console.log("nf:"+result["Netflix"])
        resolve('Not Available')
        return
      } else if (response.statusCode === 200) {
        let url = response.headers['X-Originating-URL']
        let region = url.split('/')[3]
        region = region.split('-')[0]
        if (region == 'title') {
          region = 'us'
        }
        console.log("nf:"+region)
        result["Netflix"] = "<b>Netflix: </b>完整支持"+arrow+CountryCode.get(region.toUpperCase())
        resolve("nf:"+result["Netflix"])
        return 
      }
      resolve("Netflix Test Error")
    }, reason => {
      result["Netflix"] = "<b>Netflix: </b>检测超时 🚦"
      console.log(result["Netflix"])
      resolve("timeout")
    })
  })
}

function testYTB() {
  return new Promise((resolve, reject) => {
    let option = {
      url: BASE_URL_YTB,
      opts: opts,
      timeout: 2800,
      headers: {
        'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36'
      },
    }
    $task.fetch(option).then(response=> {
      let data = response.body
      console.log("ytb:"+response.statusCode)
      if (response.statusCode !== 200) {
        result["YouTube"] = "<b>YouTube Premium: </b>检测失败 ❗️"
        resolve("error")
      } else if (data.indexOf('Premium is not available in your country') !== -1) {
        result["YouTube"] = "<b>YouTube Premium: </b>未支持 🚫"
        resolve("not available")
      } else if (data.indexOf('Premium is not available in your country') == -1) {
        let region = ''
        let re = new RegExp('"GL":"(.*?)"', 'gm')
        let ret = re.exec(data)
        if (ret != null && ret.length === 2) {
          region = ret[1]
        } else if (data.indexOf('www.google.cn') !== -1) {
          region = 'CN'
        } else {
          region = 'US'
        }
        result["YouTube"] = "<b>YouTube Premium: </b>支持 "+arrow+CountryCode.get(region.toUpperCase())
        console.log("ytb:"+region+ result["YouTube"])
        resolve(region)
      }
    }, reason => {
      result["YouTube"] = "<b>YouTube Premium: </b>检测超时 🚦"
      resolve("timeout")
    })
  })
}
