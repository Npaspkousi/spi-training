window.SPI_APP_VERSION="1.12";

const GOOGLE_FORM_BASE="https://docs.google.com/forms/d/e/1FAIpQLSdezpP4OoJ6iocQJ9xiynfBtfxS31WpTi6EpO-jyXUljMBZIw/viewform?usp=pp_url";
const FORM_ENTRY_PROBLEM_ID="entry.1021600444";
const FORM_ENTRY_QUESTION_TEXT="entry.1632223185";
const FORM_ENTRY_LEVEL="entry.1489454136";
const FORM_ENTRY_ERROR_TYPE="entry.1004720747";
const FORM_ENTRY_COMMENT="entry.1686043115";


let QUESTIONS=[];
const state={selected:[],index:0,correct:0,attempts:0,hintIndex:0,answered:false,records:[],settings:null,lastPool:[],studyMode:"normal",tutorHelpCount:0,understood:false,tutorShown:new Set()};
const $=id=>document.getElementById(id);

function init(){
  QUESTIONS = window.SPI_QUESTIONS || [];
  if (!QUESTIONS.length) {
    document.body.innerHTML = "<main class=\"app\"><section class=\"card\"><h2>問題データを読み込めませんでした。</h2><p>questions.js が index.html と同じフォルダにあるか確認してください。</p></section></main>";
    return;
  }
  $("startBtn").onclick=startQuiz;
  $("hintBtn").onclick=showHint;
  $("nextBtn").onclick=nextQuestion;
  $("restartBtn").onclick=restart;
  $("retrySameBtn").onclick=retrySame;
  $("reviewWeakBtn").onclick=reviewWeak;
  $("nextLevelBtn").onclick=nextLevel;
  $("showModelBtn").onclick=showModelAnswer;
  $("understoodBtn").onclick=markUnderstood;
  $("reportBtn").onclick=openReportModal;
  $("reportCloseBtn").onclick=closeReportModal;
  $("reportCancelBtn").onclick=closeReportModal;
  $("copyReportBtn").onclick=copyReportText;
  $("openGoogleFormBtn").onclick=openGoogleFormReport;
  $("reportType").onchange=updateReportPreview;
  $("reportComment").oninput=updateReportPreview;
  $("reportModal").onclick=(e)=>{ if(e.target===$("reportModal")) closeReportModal(); };
  $("tutorStep1Btn").onclick=()=>showTutorStep(1);
  $("tutorStep2Btn").onclick=()=>showTutorStep(2);
  $("tutorStep3Btn").onclick=()=>showTutorStep(3);
}
function shuffle(a){
  a=[...a];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}
function current(){return state.selected[state.index]}
function resetQ(){
  state.attempts=0;state.hintIndex=0;state.answered=false;
  $("hintBox").classList.add("hidden");$("feedback").classList.add("hidden");$("nextBtn").classList.add("hidden");
  $("hintBox").textContent="";$("feedback").textContent="";$("hintBtn").disabled=false;
  $("tutorPanel").classList.add("hidden");$("tutorBody").innerHTML="";
  $("tutorLead").textContent="";
  $("tutorStep1Btn").disabled=false;$("tutorStep2Btn").disabled=false;$("tutorStep3Btn").disabled=false;
  $("understandingArea").classList.add("hidden");$("modelAnswer").classList.add("hidden");
  $("modelAnswer").textContent="";$("understandingInput").value="";
  $("understoodBtn").textContent="理解できた";$("understoodBtn").disabled=false;
  state.tutorHelpCount=0;state.understood=false;state.tutorShown=new Set();
}
function render(){
  resetQ();const q=current();
  $("progress").textContent=`${state.index+1} / ${state.selected.length}`;
  $("score").textContent=`正解 ${state.correct}`;
  $("problemId").textContent=q.problem_id;$("chapter").textContent=q.chapter_name;$("difficulty").textContent=`Level ${q.difficulty}`;
  $("question").textContent=q.question_text;
  initTutorForQuestion(q);
  const box=$("options");box.innerHTML="";
  for(const k of ["A","B","C","D"]){
    const b=document.createElement("button");b.className="option";b.dataset.key=k;b.textContent=`${k}. ${q.options[k]}`;
    b.onclick=()=>answer(k);box.appendChild(b);
  }
}
function disableOptions(){document.querySelectorAll(".option").forEach(b=>b.disabled=true)}



function addTutorStep(key,title,text){
  if(state.studyMode!=="tutor") return;
  if(state.tutorShown.has(key)) return;

  state.tutorShown.add(key);
  $("tutorPanel").classList.remove("hidden");

  const div=document.createElement("div");
  div.className="tutor-step";
  div.innerHTML=`<strong>${escapeHtml(title)}</strong><br>${escapeHtml(text)}`;
  $("tutorBody").appendChild(div);

  state.tutorHelpCount++;
  updateTutorProgress();
}

function updateTutorProgress(){
  const host=document.getElementById("tutorProgress");
  if(!host) return;
  const keys=["organize","plan","finish"];
  [...host.children].forEach((el,i)=>{
    if(state.tutorShown.has(keys[i])) el.classList.add("done");
  });
}

function lastQuestionSentence(text){
  const lines=String(text).split(/\n+/).map(x=>x.trim()).filter(Boolean);
  return lines.length ? lines[lines.length-1] : text;
}

function initTutorForQuestion(q){
  if(state.studyMode!=="tutor"){
    $("tutorPanel").classList.add("hidden");
    return;
  }

  $("tutorPanel").classList.remove("hidden");
  $("tutorLead").innerHTML=`
    <div class="tutor-guide">
      <div class="tutor-guide-title">一緒に解いていこう</div>
      <div class="tutor-guide-sub">
        すぐ答えを探さず、①問題を整理 → ②方針を立てる → ③仕上げる、の順で進みます。
      </div>
      <div id="tutorProgress" class="tutor-progress">
        <span>①整理</span><span>②方針</span><span>③仕上げ</span>
      </div>
    </div>`;

  addTutorStep(
    "start",
    "まず確認",
    `この問題は「${q.chapter_name}」です。最終的に聞かれているのは「${lastQuestionSentence(q.question_text)}」です。`
  );
}

function showTutorStep(step){
  if(state.studyMode!=="tutor" || state.answered) return;
  const q=current();

  if(step===1){
    const text =
      `まず問題文から「確定していること」と「求めるもの」を分けます。` +
      (q.quick_tip ? ` この問題では、${q.quick_tip}` : "");
    addTutorStep("organize","① 問題を整理",text);
    $("tutorStep1Btn").disabled=true;

  }else if(step===2){
    let text = q.hints?.[0] || "使う条件や数値を一つずつ取り出してみましょう。";
    if(q.hints?.[1]) text += ` 次に、${q.hints[1]}`;
    addTutorStep("plan","② 方針を立てる",text);
    $("tutorStep2Btn").disabled=true;

  }else if(step===3){
    const text =
      (q.hints?.[2] || q.hints?.[1] || "ここまで整理した内容を使って、選択肢を一つずつ確かめましょう。") +
      " ここでは答えを丸暗記せず、なぜその選択肢になるかを確認してください。";
    addTutorStep("finish","③ 一緒に仕上げる",text);
    $("tutorStep3Btn").disabled=true;
  }
}

function tutorOnWrong(q,key){
  if(state.studyMode!=="tutor") return;
  const diag=q.diagnostics?.[key]?.message || "条件をもう一度整理してみましょう。";

  addTutorStep(
    `wrong-${state.attempts}`,
    "いまの考え方を確認しよう",
    `${diag} どこで判断したかを一度戻って、条件と照らし合わせてみましょう。`
  );

  if(state.attempts===1 && !state.tutorShown.has("organize")){
    showTutorStep(1);
  }else if(state.attempts===2 && !state.tutorShown.has("plan")){
    showTutorStep(2);
  }
}

function tutorOnFinish(q){
  if(state.studyMode!=="tutor") return;

  $("tutorPanel").classList.remove("hidden");
  $("tutorStep1Btn").disabled=true;
  $("tutorStep2Btn").disabled=true;
  $("tutorStep3Btn").disabled=true;

  addTutorStep(
    "solution",
    "最後に一緒に整理",
    q.explanation
  );

  $("understandingArea").classList.remove("hidden");
  $("understandingQuestion").textContent=
    q.understanding_question || "この問題の考え方を、自分の言葉で一言説明してみてください。";
}

function showModelAnswer(){
  const q=current();
  $("modelAnswer").textContent=q.understanding_answer || q.explanation || "模範回答は登録されていません。";
  $("modelAnswer").classList.remove("hidden");
}

function markUnderstood(){
  state.understood=true;
  $("understoodBtn").textContent="理解済み";
  $("understoodBtn").disabled=true;
}

function answer(k){
  if(state.answered)return;
  const q=current();state.attempts++;
  const b=document.querySelector(`.option[data-key="${k}"]`);
  if(k===q.correct_option){
    state.answered=true;state.correct++;b.classList.add("correct");disableOptions();
    $("feedback").textContent=`正解です。\n\n${q.explanation}`;$("feedback").classList.remove("hidden");
    $("nextBtn").classList.remove("hidden");$("hintBtn").disabled=true;
    tutorOnFinish(q);
    state.records.push({
      id:q.problem_id,
      result:"正解",
      attempts:state.attempts,
      firstTry:state.attempts===1,
      hintsUsed:state.hintIndex,
      chapter:q.chapter_name,
      level:q.difficulty,
      question:q.question_text,
      selected:k,
      selectedText:q.options[k],
      correct:q.correct_option,
      correctText:q.options[q.correct_option],
      explanation:q.explanation,
      tutorHelpCount:state.tutorHelpCount,
      understood:state.understood
    });
    $("score").textContent=`正解 ${state.correct}`;
    return;
  }
  b.classList.add("wrong");b.disabled=true;
  const msg=q.diagnostics?.[k]?.message||"条件をもう一度確認してください。";
  tutorOnWrong(q,k);
  if(state.attempts>=q.max_attempts){
    state.answered=true;disableOptions();
    const cb=document.querySelector(`.option[data-key="${q.correct_option}"]`);if(cb)cb.classList.add("correct");
    $("feedback").textContent=`不正解です。\n${msg}\n\n正解：${q.correct_option}. ${q.options[q.correct_option]}\n\n${q.explanation}`;
    $("nextBtn").classList.remove("hidden");$("hintBtn").disabled=true;
    tutorOnFinish(q);
    state.records.push({
      id:q.problem_id,
      result:"不正解",
      attempts:state.attempts,
      firstTry:false,
      hintsUsed:state.hintIndex,
      chapter:q.chapter_name,
      level:q.difficulty,
      question:q.question_text,
      selected:k,
      selectedText:q.options[k],
      correct:q.correct_option,
      correctText:q.options[q.correct_option],
      explanation:q.explanation,
      tutorHelpCount:state.tutorHelpCount,
      understood:state.understood
    });
  }else{
    $("feedback").textContent=`不正解です。あと ${q.max_attempts-state.attempts} 回挑戦できます。\n${msg}`;
  }
  $("feedback").classList.remove("hidden");
}
function showHint(){
  const q=current();

  if(state.studyMode==="tutor"){
    if(!state.tutorShown.has("organize")){
      showTutorStep(1);
    }else if(!state.tutorShown.has("plan")){
      showTutorStep(2);
    }else if(!state.tutorShown.has("finish")){
      showTutorStep(3);
    }else{
      $("hintBox").textContent="ここまでの手順を使って、一度自分で答えを選んでみてください。";
      $("hintBox").classList.remove("hidden");
    }
    state.hintIndex++;
    return;
  }

  if(state.hintIndex>=q.hints.length){
    $("hintBox").textContent="これ以上ヒントはありません。";
  }else{
    $("hintBox").textContent=`ヒント ${state.hintIndex+1}: ${q.hints[state.hintIndex]}`;
    state.hintIndex++;
  }
  $("hintBox").classList.remove("hidden");
}
function nextQuestion(){state.index++;state.index>=state.selected.length?showResult():render()}
function showResult(){
  $("quiz").classList.add("hidden");
  $("result").classList.remove("hidden");

  const total=state.selected.length;
  const pct=Math.round(state.correct/total*100);
  const firstTryCount=state.records.filter(r=>r.firstTry).length;
  const firstTryPct=Math.round(firstTryCount/total*100);
  const retryCount=state.records.filter(r=>r.attempts>1).length;
  const hintCount=state.records.reduce((sum,r)=>sum+r.hintsUsed,0);
  const tutorHelp=state.records.reduce((sum,r)=>sum+(r.tutorHelpCount||0),0);

  const categories={};
  for(const r of state.records){
    if(!categories[r.chapter]) categories[r.chapter]={total:0,correct:0,first:0};
    categories[r.chapter].total++;
    if(r.result==="正解") categories[r.chapter].correct++;
    if(r.firstTry) categories[r.chapter].first++;
  }

  const categoryRows=Object.entries(categories).map(([name,v])=>{
    const rate=Math.round(v.correct/v.total*100);
    const first=Math.round(v.first/v.total*100);
    return `<tr><td>${name}</td><td>${v.correct}/${v.total}</td><td>${rate}%</td><td>${first}%</td></tr>`;
  }).join("");

  let message="";
  if(pct===100 && firstTryPct===100){
    message="全問を1回目で正解しました。この条件は十分に安定しています。次のLevelへ進む候補です。";
  }else if(pct===100){
    message="最終的には全問正解です。ただし再挑戦した問題があります。1回目で迷った問題を復習すると、処理速度と安定性を上げられます。";
  }else if(pct>=80){
    message="全体として良好です。間違えた問題と、再挑戦した問題を優先して復習してください。";
  }else{
    message="まだ不安定な分野があります。間違えた問題を中心に、解説とヒントを確認してから同条件で再挑戦するのがおすすめです。";
  }

  const reviews=state.records.map((r,i)=>{
    const weak=(r.result!=="正解" || !r.firstTry || r.hintsUsed>0);
    const cls=r.result==="正解"?"review-ok":"review-ng";

    let statusBadges="";
    if(r.firstTry && r.hintsUsed===0){
      statusBadges+=`<span class="badge good">1回目正解</span>`;
    }else{
      if(r.attempts>1) statusBadges+=`<span class="badge warn">${r.attempts}回目で確定</span>`;
      if(r.hintsUsed>0) statusBadges+=`<span class="badge warn">ヒント${r.hintsUsed}回</span>`;
      if(r.result!=="正解") statusBadges+=`<span class="badge bad">最終不正解</span>`;
      if(weak) statusBadges+=`<span class="badge warn">要復習</span>`;
    }

    const selected=`${r.selected}. ${r.selectedText}`;
    const correct=`${r.correct}. ${r.correctText}`;

    return `<details class="review-item ${cls}">
      <summary>
        <span class="review-question-title">${escapeHtml(shortQuestion(r.question))}</span>
        <span class="review-id">${r.id} / ${escapeHtml(r.chapter)}</span>
        <span class="review-status">${statusBadges}</span>
      </summary>
      <div class="review-body">
問題：
${escapeHtml(r.question)}

自分の回答：
${escapeHtml(selected)}

正解：
${escapeHtml(correct)}

解説：
${escapeHtml(r.explanation)}
      </div>
    </details>`;
  }).join("");

  $("resultBody").innerHTML=`
    <div class="result-summary">
      <div class="summary-card"><div class="summary-label">最終正答率</div><div class="summary-value">${pct}%</div></div>
      <div class="summary-card"><div class="summary-label">1回目正解率</div><div class="summary-value">${firstTryPct}%</div></div>
      <div class="summary-card"><div class="summary-label">再挑戦した問題</div><div class="summary-value">${retryCount}問</div></div>
      <div class="summary-card"><div class="summary-label">使用ヒント</div><div class="summary-value">${hintCount}回</div></div>
      ${state.studyMode==="tutor"?`<div class="summary-card"><div class="summary-label">家庭教師支援</div><div class="summary-value">${tutorHelp}回</div></div>`:""}
    </div>

    <div class="result-message">${message}</div>

    <h3>カテゴリ別</h3>
    <table class="category-table">
      <thead><tr><th>カテゴリ</th><th>正解</th><th>最終正答率</th><th>1回目正解率</th></tr></thead>
      <tbody>${categoryRows}</tbody>
    </table>

    <h3>問題ごとの振り返り</h3>
    <div class="review-list">${reviews}</div>
  `;

  const weak=state.records.filter(r=>r.result!=="正解" || !r.firstTry || r.hintsUsed>0);
  $("reviewWeakBtn").disabled=weak.length===0;

  const weakNote = weak.length
    ? `<div class="weak-note">要復習：${weak.length}問。最終正解でも、再挑戦した問題やヒントを使った問題は復習対象にしています。</div>`
    : `<div class="weak-note">要復習問題はありません。全問を1回目・ヒントなしで正解しています。</div>`;
  $("resultBody").insertAdjacentHTML("beforeend", weakNote);

  const lv=state.settings?.level;
  $("nextLevelBtn").disabled=(lv==="all" || Number(lv)>=5 || pct<80);
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function shortQuestion(text){
  const one=String(text).replace(/\s+/g," ").trim();
  return one.length>70 ? one.slice(0,70)+"…" : one;
}
function startQuiz(){
  const d=$("domain").value,l=$("level").value,c=Number($("count").value),m=$("studyMode").value;
  state.studyMode=m;
  let pool=QUESTIONS.filter(q=>(d==="all"||q.domain===d)&&(l==="all"||q.difficulty===Number(l)));
  state.settings={domain:d,level:l,count:c,studyMode:m};
  state.lastPool=[...pool];
  if(!pool.length){$("setupMsg").textContent="該当する問題がありません。";return}
  state.selected=shuffle(pool).slice(0,Math.min(c,pool.length));state.index=0;state.correct=0;state.records=[];
  $("setup").classList.add("hidden");$("result").classList.add("hidden");$("quiz").classList.remove("hidden");render();
}

function launchFromPool(pool,count){
  state.selected=shuffle(pool).slice(0,Math.min(count,pool.length));
  if(state.settings?.studyMode) state.studyMode=state.settings.studyMode;
  state.index=0;
  state.correct=0;
  state.records=[];
  $("result").classList.add("hidden");
  $("setup").classList.add("hidden");
  $("quiz").classList.remove("hidden");
  render();
}

function retrySame(){
  if(!state.settings) return;
  launchFromPool(state.lastPool,state.settings.count);
}

function reviewWeak(){
  const ids=new Set(
    state.records
      .filter(r=>r.result!=="正解" || !r.firstTry || r.hintsUsed>0)
      .map(r=>r.id)
  );
  const pool=QUESTIONS.filter(q=>ids.has(q.problem_id));
  if(!pool.length) return;
  launchFromPool(pool,pool.length);
}

function nextLevel(){
  if(!state.settings || state.settings.level==="all") return;
  const next=Number(state.settings.level)+1;
  if(next>5) return;

  const d=state.settings.domain;
  const pool=QUESTIONS.filter(q=>(d==="all"||q.domain===d)&&q.difficulty===next);
  if(!pool.length) return;

  state.settings={domain:d,level:String(next),count:state.settings.count,studyMode:state.studyMode};
  state.lastPool=[...pool];
  launchFromPool(pool,state.settings.count);
}


function buildReportText(){
  const q=current();
  if(!q) return "";
  const type=$("reportType").value;
  const comment=$("reportComment").value.trim();
  return [
    "【SPI問題エラー報告】",
    `バージョン: ${window.SPI_APP_VERSION || "不明"}`,
    `問題ID: ${q.problem_id}`,
    `分野: ${q.chapter_name}`,
    `Level: ${q.difficulty}`,
    `報告種別: ${type}`,
    "",
    "問題文:",
    q.question_text,
    "",
    "補足:",
    comment || "なし"
  ].join("\\n");
}
function updateReportPreview(){$("reportPreview").textContent=buildReportText();}
function openReportModal(){
  $("reportComment").value="";
  $("reportType").selectedIndex=0;
  updateReportPreview();
  $("reportModal").classList.remove("hidden");
}
function closeReportModal(){$("reportModal").classList.add("hidden");}
async function copyReportText(){
  const text=buildReportText();
  try{
    await navigator.clipboard.writeText(text);
  }catch(e){
    const area=document.createElement("textarea");
    area.value=text;document.body.appendChild(area);area.select();document.execCommand("copy");area.remove();
  }
  $("copyReportBtn").textContent="コピーしました";
  setTimeout(()=>$("copyReportBtn").textContent="報告文をコピー",1500);
}


function buildGoogleFormUrl(){
  const q=current();
  if(!q) return GOOGLE_FORM_BASE;

  const params = new URLSearchParams();
  params.set(FORM_ENTRY_PROBLEM_ID, q.problem_id || "");
  params.set(FORM_ENTRY_QUESTION_TEXT, q.question_text || "");
  params.set(FORM_ENTRY_LEVEL, `Level${q.difficulty ?? ""}`);
  params.set(FORM_ENTRY_ERROR_TYPE, $("reportType").value || "");
  params.set(FORM_ENTRY_COMMENT, $("reportComment").value.trim() || "");

  const joiner = GOOGLE_FORM_BASE.includes("?") ? "&" : "?";
  return GOOGLE_FORM_BASE + joiner + params.toString();
}

function openGoogleFormReport(){
  updateReportPreview();
  const url = buildGoogleFormUrl();
  window.open(url, "_blank", "noopener");
}

function restart(){$("result").classList.add("hidden");$("quiz").classList.add("hidden");$("setup").classList.remove("hidden")}
window.addEventListener("DOMContentLoaded",init);
