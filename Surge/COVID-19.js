var list = ["宁波","徐州","上海"];
const url = "https://view.inews.qq.com/g2/getOnsInfo?name=disease_h5";
var ala="";
var num1="";
var num2="";
var num11="";
var num22="";
var blank11="";
var blank22="";
var numrep = new Map([[ "0" , "⓪" ] ,[ "1" , "①" ] ,["2","②"], [ "3" , "③" ] , [ "4" , "④" ] , [ "5" , "⑤" ] , [ "6" , "⑥" ] , [ "7" , "⑦" ] , [ "8" , "⑧" ] , [ "9" , "⑨" ]]);
function num(location, result) {
  var loc = location;
  var resu = result;
  var loc_newcf = new RegExp(loc + "[\\s\\S]*?confirm[\\s\\S]{3}(\\d+)");
  var loc_wzz = new RegExp(loc + "[\\s\\S]*?wzz_add[\\s\\S]{3}(\\d+)");
  let loc_newcf_res = loc_newcf.exec(resu);
  let loc_wzz_res = loc_wzz.exec(resu);
  if (loc_newcf_res) {
  num1=loc_newcf_res[1].padStart(6,"\u0020");
  num2=loc_wzz_res[1].padStart(6,"\u0020");
    num11=num1.replace(/\s/g, "");
    num22=num2.replace(/\s/g, "");
    blank11="";
    blank22="";
    for (var i = 0; i < 17-num11.length; i++) {
    blank11+=" ";
    }
    if ((num11.length+num22.length)%2===0) {
    for (var i = 0; i < 17-num11.length-num22.length; i++) {
    blank22+=" ";
    }
    }
    else {
    for (var i = 0; i < 16-num11.length-num22.length; i++) {
    blank22+=" ";
    }
    }
    ala = ala +loc +blank11+maps(num11.padStart(num11.length,"\u0020"))+blank22+maps(num22.padStart(num22.length,"\u0020"))+ "\n";
  } else {
    ala = ala + loc + "           查无数据\n";
  }
};

function maps(number) {
    var k="";
for (var i = number.length; i > 0; i--) {
    var numArr = number.split("");
    var j = numArr[numArr.length-i];
    k = k.concat(numrep.get(j));
    }
return k;
};

$httpClient.get(url, function(error, response, data){
  let res = data;
  let now = new Date();
  let hour = now.getHours();
  let minutes = now.getMinutes();
  hour = hour > 9 ? hour : "0" + hour;
  minutes = minutes > 9 ? minutes : "0" + minutes;
  for (var i = 0; i < list.length; i++) {
    num(list[i], res);
    if (i == list.length - 1) {
     $done({
       title: "COVID-19:   确诊   |   无症状   |   "+hour+":"+minutes,
       icon:"heart.text.square",
       "icon-color":"#E94335",
       content: ala.replace(/\n$/, "").replace("中国", "全国")
     });
    }
  }
});