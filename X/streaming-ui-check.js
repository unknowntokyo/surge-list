const BASE_URL = 'https://www.netflix.com/title/';
const BASE_URL_YTB = "https://www.youtube.com/premium";
const FILM_ID = 81215567
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

var ChineseSimplified = new Map([["AD","AND"],["AE","UAE"],["AF","AFG"],["AG","ANT"],["AL","ALB"],["AM","ARM"],["AO","ANG"],["AR","ARG"],["AS","ASA"],["AT","AUT"],["AU","AUS"],["AW","ARU"],["AZ","AZE"],["BA","BIH"],["BB","BAR"],["BD","BAN"],["BE","BEL"],["BF","BUR"],["BG","BUL"],["BH","BRN"],["BI","BDI"],["BJ","BEN"],["BM","BER"],["BN","BRU"],["BO","BOL"],["BR","BRA"],["BS","BAH"],["BT","BHU"],["BW","BOT"],["BY","BLR"],["BZ","BIZ"],["CA","CAN"],["CD","COD"],["CF","CAF"],["CG","CGO"],["CH","SUI"],["CI","CIV"],["CK","COK"],["CL","CHI"],["CM","CMR"],["CN","CHN"],["CO","COL"],["CR","CRC"],["CU","CUB"],["CV","CPV"],["CY","CYP"],["CZ","CZE"],["DE","GER"],["DJ","DJI"],["DK","DEN"],["DM","DMA"],["DO","DOM"],["DZ","ALG"],["EC","ECU"],["EE","EST"],["EG","EGY"],["ER","ERI"],["ES","ESP"],["ET","ETH"],["FI","FIN"],["FJ","FIJ"],["FR","FRA"],["GA","GAB"],["GB","GBR"],["GD","GRN"],["GE","GEO"],["GH","GHA"],["GM","GAM"],["GN","GUI"],["GQ","GEQ"],["GR","GRE"],["GT","GUA"],["GU","GUM"],["GW","GBS"],["GY","GUY"],["HK","HKG"],["HN","HON"],["HR","CRO"],["HT","HAI"],["HU","HUN"],["ID","INA"],["IE","IRL"],["IL","ISR"],["IN","IND"],["IQ","IRQ"],["IR","IRI"],["IS","ISL"],["IT","ITA"],["JM","JAM"],["JO","JOR"],["JP","JPN"],["KE","KEN"],["KG","KGZ"],["KH","CAM"],["KI","KIR"],["KM","COM"],["KN","SKN"],["KR","KOR"],["KW","KUW"],["KY","CAY"],["KZ","KAZ"],["LA","LAO"],["LB","LBN"],["LC","LCA"],["LI","LIE"],["LK","SRI"],["LR","LBR"],["LS","LES"],["LT","LTU"],["LU","LUX"],["LV","LAT"],["LY","LBA"],["MA","MAR"],["MC","MON"],["MD","MDA"],["ME","MNE"],["MG","MAD"],["MH","MHL"],["MK","MKD"],["ML","MLI"],["MM","MYA"],["MN","MGL"],["MR","MTN"],["MT","MLT"],["MU","MRI"],["MV","MDV"],["MW","MAW"],["MX","MEX"],["MY","MAS"],["MZ","MOZ"],["NA","NAM"],["NE","NIG"],["NG","NGR"],["NI","NCA"],["NL","NED"],["NO","NOR"],["NR","NRU"],["NZ","NZL"],["OM","OMA"],["PA","PAN"],["PE","PER"],["PG","PNG"],["PH","PHI"],["PK","PAK"],["PL","POL"],["PR","PUR"],["PS","PLE"],["PT","POR"],["PW","PLW"],["PY","PAR"],["QA","QAT"],["RO","ROU"],["RS","SRB"],["RU","RUS"],["RW","RWA"],["SA","KSA"],["SB","SOL"],["SC","SEY"],["SD","SUD"],["SE","SWE"],["SG","SGP"],["SI","SLO"],["SK","SVK"],["SL","SLE"],["SM","SMR"],["SN","SEN"],["SO","SOM"],["SR","SUR"],["SS","SSD"],["ST","STP"],["SV","ESA"],["SY","SYR"],["SZ","SWZ"],["TD","CHA"],["TG","TOG"],["TH","THA"],["TJ","TJK"],["TL","TLS"],["TM","TKM"],["TN","TUN"],["TO","TGA"],["TR","TUR"],["TT","TTO"],["TV","TUV"],["TW","TPE"],["TZ","TAN"],["UA","UKR"],["UG","UGA"],["US","USA"],["UY","URU"],["UZ","UZB"],["VC","VIN"],["VE","VEN"],["VG","IVB"],["VN","VIE"],["VU","VAN"],["WS","SAM"],["YE","YEM"],["ZA","RSA"],["ZM","ZAM"],["ZW","ZIM"]])

let result = {
  "title": '          流媒体解锁检测',
  "YouTube": '<b>YouTube:  </b>检测失败, 请重试 ❗️',
  "Netflix": '<b>Netflix:  </b>检测失败, 请重试 ❗️',

}
const message = {
  action: "get_policy_state",
  content: $environment.params
};

;(async () => {
  testYTB()
  let [{ region, status }] = await Promise.all([testNf(FILM_ID)])
  console.log(result["Netflix"])

  let content = "------------------------------"+"</br>"+([result["YouTube"],result["Netflix"]]).join("</br></br>")
  content = content + "</br>------------------------------</br>"+"<font color=#007AFF>"+"<b>节点</b> ➟ " + $environment.params+ "</font>"
  content =`<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">` + content + `</p>`

$configuration.sendMessage(message).then(resolve => {
    if (resolve.error) {
      console.log(resolve.error);
      $done()
    }
    if (resolve.ret) {
      let output=JSON.stringify(resolve.ret[message.content])? JSON.stringify(resolve.ret[message.content]).replace(/\"|\[|\]/g,"").replace(/\,/g," ➟ ") : $environment.params
      let content = "--------------------------------------</br>"+([result["Netflix"],result["YouTube"]]).join("</br></br>")
      content = content + "</br>--------------------------------------</br>"+"<font color=#007AFF>"+"<b>节点</b> ➟ " + output+ "</font>"
      content =`<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">` + content + `</p>`
      //$notify(typeof(output),output)
      console.log(output);
      $done({"title":result["title"],"htmlMessage":content})
      
    }
    //$done();|
  }, reject => {
    // Normally will never happen.
    $done();
  });  
  //$done({"title":result["title"],"htmlMessage":content})
})()
.finally(() => {
  $configuration.sendMessage(message).then(resolve => {
    if (resolve.error) {
      console.log(resolve.error);
      $done()
    }
    if (resolve.ret) {
      let output=JSON.stringify(resolve.ret[message.content])? JSON.stringify(resolve.ret[message.content]).replace(/\"|\[|\]/g,"").replace(/\,/g," ➟ ") : $environment.params
      let content = "--------------------------------------</br>"+([result["Netflix"],result["YouTube"]]).join("</br></br>")
      content = content + "</br>--------------------------------------</br>"+"<font color=#007AFF>"+"<b>节点</b> ➟ " + output+ "</font>"
      content =`<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">` + content + `</p>`
      //$notify(typeof(output),output)
      console.log(output);
      $done({"title":result["title"],"htmlMessage":content})
      
    }
    //$done();|
  }, reject => {
    // Normally will never happen.
    $done();
  });   
    $done({"title":result["title"],"htmlMessage":`<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">`+'----------------------</br></br>'+"🚥 检测异常"+'</br></br>----------------------</br>'+ output + `</p>`})
}
  );

function timeout(delay = 5000) {
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
      timeout: 5200,
      headers: {
        'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
      },
    }
    $task.fetch(option).then(response => {
      //$notify("nf:"+response.statusCode)
      console.log("nf:"+response.statusCode)
      if (response.statusCode === 404) {
        
        result["Netflix"] = "<b>Netflix:  </b>仅自制 ⚠️"
        console.log("nf:"+result["Netflix"])
        resolve('Not Found')
        return 
      } else if (response.statusCode === 403) {
        
        //console.log("nfnf")
        result["Netflix"] = "<b>Netflix:  </b>未解锁 ✘"
        console.log("nf:"+result["Netflix"])
        //$notify("nf:"+result["Netflix"])
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
        result["Netflix"] = "<b>Netflix:  </b>全解锁"+arrow+ ChineseSimplified.get(region.toUpperCase())
        //$notify("nf:"+result["Netflix"])

        resolve("nf:"+result["Netflix"])
        return 
      }
    }, reason => {
      result["Netflix"] = "<b>Netflix:  </b>检测超时 🚦"
      console.log(result["Netflix"])
      resolve("timeout")
    }
    )
  }
  )
}

function testYTB() { 
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
        
        result["YouTube"] = "<b>YouTube:  </b>检测失败 ❗️"
      } else if (data.indexOf('Premium is not available in your country') !== -1) {
          
        result["YouTube"] = "<b>YouTube:  </b>未解锁 ✘"
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
      //resolve(region)
      result["YouTube"] = "<b>YouTube:  </b>已解锁"+arrow+ ChineseSimplified.get(region.toUpperCase())
      console.log("ytb:"+region+ result["YouTube"])
      }
    }, reason => {
      result["YouTube"] = "<b>YouTube:  </b>检测超时 🚦"
      //resolve("timeout")
    })
}