(window.webpackJsonp=window.webpackJsonp||[]).push([[15],{1447:function(d,l,o){"use strict";o.r(l),o.d(l,"default",function(){return c});var u=o(93),t=o.n(u),i=o(116),h=o.n(i),m=o(127);class c extends t.a.PureComponent{constructor(a){super(a);this.state={},this.onChange=this.onChange.bind(this),this.onSubmit=this.onSubmit.bind(this)}onChange(a){this.setState({[a.target.name]:a.target.value})}onSubmit(a){a.preventDefault();const e=Object(i.sortBy)(Object.entries(this.state).map(r=>[+r[0],r[1]])),n=e[e.length-1][0],s=new Array(n).fill("");e.forEach(r=>s[r[0]]=r[1]),m.a.post(this.props.target,{lang:"_",code:s.join(`
`)}).then(r=>{window.location.href=r.url}).catch(r=>{Notification.error(r.message)})}Textbox(a,e){return t.a.createElement("label",{htmlFor:`textbox${e}`},e+1,". ",a.desc.split(`
`).map((n,s)=>s?t.a.createElement(t.a.Fragment,null,t.a.createElement("br",null),n):n),t.a.createElement("div",{name:`form_item_${e}`,className:"textbox-container"},t.a.createElement("input",{type:"text",name:e,id:`textbox${e}`,className:"textbox",onChange:this.onChange})))}Radio(a,e){return t.a.createElement(t.a.Fragment,null,e+1,". ",a.desc.split(`
`).map((n,s)=>s?t.a.createElement(t.a.Fragment,null,t.a.createElement("br",null),n):n),a.choices.map(n=>t.a.createElement("label",{className:"radiobox",htmlFor:`radio${e}${n}`,key:n},t.a.createElement("input",{type:"radio",name:e,id:`radio${e}${n}`,value:n,onChange:this.onChange})," ",n," ",t.a.createElement("br",null))))}render(){return t.a.createElement("form",{onSubmit:this.onSubmit},this.props.panel.map((a,e)=>t.a.createElement("div",{className:"row",key:a},t.a.createElement("div",{className:"medium-7 columns form__item end"},a.choices?this.Radio(a,e):this.Textbox(a,e)))),document.getElementsByClassName("nav__item--round").length?t.a.createElement("input",{type:"submit",disabled:!0,className:"button rounded primary",value:"\u767B\u5F55\u540E\u63D0\u4EA4"}):t.a.createElement("input",{type:"submit",className:"button rounded primary",value:"\u63D0\u4EA4"}))}}}}]);
