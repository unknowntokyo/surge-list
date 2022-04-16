var list = ["宁波","徐州","上海"];
const url = "https://view.inews.qq.com/g2/getOnsInfo?name=disease_h5";
var ala="";
var num1="";
var num2="";
var num11="";
var num22="";
var blank11="";
var blank22="";
function num(location, result) {
  var loc = location;
  var resu = result;
  var loc_new = new RegExp(loc + "[\\s\\S]*?confirm[\\s\\S]{3}(\\d+)");
  var loc_now = new RegExp(loc + "[\\s\\S]*?wzz_add[\\s\\S]{3}(\\d+)");
  let loc_new_res = loc_new.exec(resu);
  let loc_now_res = loc_now.exec(resu);
  if (loc_new_res) {
  num1=loc_new_res[1].padStart(5,"\u0020");
  num2=loc_now_res[1].padStart(5,"\u0020");
    num11=num1.replace(/\s/g, "");
    num22=num2.replace(/\s/g, "");
    blank11="";
    blank22="";
    if (num11.length%2===0) {
    for (var i = 0; i < 17-num11.length; i++) {
    blank11+=" ";
    }
    }
    else {
    for (var i = 0; i < 18-num11.length; i++) {
    blank11+=" ";
    }
    }
    if (num22.length%2===0) {
    for (var i = 0; i < 15-num11.length-num22.length; i++) {
    blank22+=" ";
    }
    }
    else {
    for (var i = 0; i < 16-num11.length-num22.length; i++) {
    blank22+=" ";
    }
    }
    ala = ala +loc +blank11+num11.padStart(num11.length,"\u0020")+blank22+num22.padStart(num22.length,"\u0020")+ "\n";
  } else {
    ala = ala + loc + "           查无数据\n";
  }
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