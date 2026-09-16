const FICHE_DATE='13 septembre 2026';
const DATE_2026='<span class="date-highlight">DEPUIS LE 1er SEPTEMBRE 2026</span>';
const DATE_2027='<span class="date-highlight">À COMPTER DU 1er SEPTEMBRE 2027</span>';
const dateLabel=date=>date==='1er septembre 2026'?DATE_2026:date==='1er septembre 2027'?DATE_2027:'à préciser';
const categoryLabels={
  small:'Micro-entreprise',
  pme:'PME',
  eti:'Entreprise de taille intermédiaire (ETI)',
  large:'Grande entreprise'
};
const questions=[
{id:"size",text:"Quelle est la catégorie de votre entreprise ?",help:"Si la catégorie n’est pas renseignée dans les données publiques ou si vous ne la connaissez pas, choisissez « Je ne connais pas encore ma catégorie » : U GREGALE vous aidera à la déterminer à partir des critères officiels.",options:[["small","Micro-entreprise"],["pme","PME"],["eti","Entreprise de taille intermédiaire (ETI)"],["large","Grande entreprise"],["unknown","Je ne connais pas encore ma catégorie"]]},
{id:"clients",text:"Quels sont vos clients ou futurs clients ?",help:"Sélectionnez toutes les catégories qui correspondent à votre clientèle actuelle ou à celle que vous prévoyez de facturer.",multi:true,options:[["business_fr","Entreprises / professionnels en France (B2B)"],["business_foreign","Entreprises / professionnels à l’étranger (B2B international)"],["public","Collectivités publiques ou organismes publics"],["private","Particuliers (B2C)"]]},
{id:"billing",text:"Émettez-vous actuellement des factures ?",help:"Cette information permet de distinguer votre situation actuelle de la clientèle que vous prévoyez de facturer.",options:[["yes","Oui"],["no","Non, aucune prestation ni vente n’a encore été effectuée"]]},
{id:"activity",text:"Que vendez-vous principalement ?",help:"Cette réponse aide notamment à repérer les situations où les données de paiement peuvent être concernées.",options:[["goods","Des marchandises"],["services","Des prestations de services"],["both","Les deux"]]},
{id:"vat",text:"Concernant votre TVA :",help:"Votre régime de TVA est consultable dans votre espace professionnel sur le site impots.gouv.fr, via le service « Déclarer la TVA ».",options:[["franchise","Je bénéficie de la franchise en base de TVA"],["simplified","Je suis au régime simplifié d’imposition de la TVA"],["real_quarter","Je suis au régime réel normal avec déclaration trimestrielle"],["real_month","Je suis au régime réel normal avec déclaration mensuelle"],["exempt","Mon activité bénéficie d’une exonération particulière"],["unknown","Je ne connais pas encore mon régime de TVA"]]}
];
let step=0,answers={},mode="main";
const $=id=>document.getElementById(id);
$('startSiret').onclick=()=>{$('siretBox').classList.toggle('hidden');if(!$('siretBox').classList.contains('hidden'))$('siret').focus()};
$('startConcerned').onclick=()=>startManual();

function normalizeSiret(v){return String(v||'').replace(/\s+/g,'').replace(/[-.]/g,'');}
function isValidSiret(s){
  if(!/^\d{14}$/.test(s))return false;
  let sum=0;
  for(let i=0;i<14;i++){let n=Number(s[i]);if(i%2===0){n*=2;if(n>9)n-=9;}sum+=n;}
  return sum%10===0;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function mapApiCategory(v){
  const x=String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
  // L'API peut renvoyer soit le code court (PME, ETI, GE, MICRO),
  // soit un libellé complet comme « Petite ou Moyenne Entreprise (PME) ».
  if(x==='MICRO' || x.includes('MICRO-ENTREPRISE') || x.includes('MICRO ENTREPRISE'))return 'small';
  if(x==='PME' || x.includes('PME') || x.includes('PETITE OU MOYENNE ENTREPRISE'))return 'pme';
  if(x==='ETI' || x.includes('ETI') || x.includes('TAILLE INTERMEDIAIRE'))return 'eti';
  if(x==='GE' || x==='GRANDE' || x.includes('GRANDE ENTREPRISE'))return 'large';
  return null;
}
function pickSiretRecord(data,siret){
  const results=Array.isArray(data?.results)?data.results:[];
  for(const r of results){if(r?.siege?.siret===siret)return {r,e:r.siege};}
  for(const r of results){for(const e of (r?.matching_etablissements||[])){if(e?.siret===siret)return {r,e};}}
  return results[0]?{r:results[0],e:results[0].siege||{}}:null;
}
async function lookupSiret(){
  const input=$('siret'),msg=$('siretMsg'),preview=$('siretPreview'),btn=$('siretContinue');
  const siret=normalizeSiret(input.value);input.value=siret;preview.classList.add('hidden');preview.innerHTML='';
  if(!isValidSiret(siret)){msg.textContent='Veuillez saisir un SIRET valide de 14 chiffres.';return;}
  btn.disabled=true;msg.textContent='Recherche des informations publiques en cours…';
  try{
    const url='https://recherche-entreprises.api.gouv.fr/search?q='+encodeURIComponent(siret)+'&per_page=1';
    const res=await fetch(url,{headers:{Accept:'application/json'}});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data=await res.json();const found=pickSiretRecord(data,siret);
    if(!found||!found.r){throw new Error('not_found');}
    const r=found.r,e=found.e||{};
    const category=mapApiCategory(r.categorie_entreprise);
    const active=(r.etat_administratif==='A'||e.etat_administratif==='A');
    const address=e.adresse||r.siege?.adresse||'';
    const naf=e.activite_principale||r.activite_principale||'';
    const naf25=e.activite_principale_naf25||'';
    const tva=Array.isArray(r.tva)?r.tva.join(', '):(r.tva||'');
    window.siretLookup={siret,r,e,category};
    preview.innerHTML=`<h2>Entreprise trouvée</h2><p><strong>${esc(r.nom_complet||r.nom_raison_sociale||'Entreprise')}</strong></p>
      <div class="siret-grid">
        <div class="siret-item"><strong>SIRET</strong>${esc(e.siret||siret)}</div>
        <div class="siret-item"><strong>État</strong>${active?'En activité':'À vérifier : établissement non actif'}</div>
        <div class="siret-item"><strong>Catégorie INSEE</strong>${esc(r.categorie_entreprise||'Non renseignée')}</div>
        <div class="siret-item"><strong>Activité principale</strong>${esc(naf||'Non renseignée')}${naf25?`<br><span class="small">NAF 2025 : ${esc(naf25)}</span>`:''}</div>
        <div class="siret-item"><strong>Adresse</strong>${esc(address||'Non renseignée')}</div>
        ${tva?`<div class="siret-item"><strong>N° TVA intracommunautaire</strong>${esc(tva)}</div>`:''}
      </div>
      <p class="small">Ces données sont publiques. Elles servent à préremplir le diagnostic ; elles ne permettent pas de déduire votre régime de TVA ni vos types de clients.</p>
      ${category?`<button id="useSiret" class="siret-confirm">Utiliser ces informations et continuer →</button>`:''}
      ${!category?`<div class="siret-help"><strong>Catégorie d’entreprise non renseignée</strong><p class="small">Cette information n’est pas disponible dans les données publiques consultées. U GREGALE vous proposera de la déterminer à partir des critères officiels avant de finaliser votre fiche.</p></div><button id="useSiret" class="siret-confirm">Continuer et préciser ma catégorie →</button>`:''}`;
    preview.classList.remove('hidden');msg.textContent='';
    $('useSiret').onclick=()=>{
      $('intro').classList.add('hidden');
      $('quiz').classList.remove('hidden');
      answers={siret:siret,siretInfo:{siret,r,e,category}};
      if(category){
        answers.size=category;
        console.log('U GREGALE — catégorie SIRET préremplie :', category, r.categorie_entreprise);
        showPrefilledCategory(category);
      }else{
        // Category is absent from the public data: go directly to the helper
        // instead of making the user pass through Q1 and select "unknown".
        mode='main';
        step=0;
        preciseCategory();
      }
    };
  }catch(err){
    console.error(err);msg.textContent=err.message==='not_found'?'SIRET introuvable dans la base publique. Vérifiez le numéro et réessayez.':'La recherche n’a pas pu aboutir pour le moment. Vous pouvez commencer le diagnostic manuellement.';
  }finally{btn.disabled=false;}
}
$("siretContinue").onclick=lookupSiret;
function startManual(){mode="main";$('intro').classList.add('hidden');$('quiz').classList.remove('hidden');step=0;answers={};render()}
function currentQuestions(){return questions}
function recapForStep(currentStep){
  const items=[];
  if(currentStep>0 && answers.size && categoryLabels[answers.size])items.push(['Catégorie',categoryLabels[answers.size]]);
  if(currentStep>1 && Array.isArray(answers.clients) && answers.clients.length){
    const labels=questions.find(q=>q.id==='clients').options
      .filter(([v])=>answers.clients.includes(v)).map(([,label])=>label);
    if(labels.length)items.push(['Clients',labels.join(' + ')]);
  }
  if(currentStep>2 && answers.billing){
    const label=answers.billing==='yes'?'je facture actuellement':'je n’ai encore émis aucune facture';
    items.push(['Facturation',label]);
  }
  if(currentStep>3 && answers.activity){
    const labels={goods:'des marchandises',services:'des prestations de services',both:'vente de marchandises et prestations de services',};
    items.push(['Activité',labels[answers.activity]||answers.activity]);
  }
  if(currentStep>4 && answers.vat){
    const labels={
      franchise:'franchise en base de TVA',
      simplified:'régime simplifié d’imposition de la TVA',
      real_quarter:'régime réel normal avec déclaration trimestrielle',
      real_month:'régime réel normal avec déclaration mensuelle',
      exempt:'exonération particulière',
      unknown:'régime de TVA à préciser'
    };
    let vatLabel=labels[answers.vat]||answers.vat;
    if(answers.vat==='exempt' && answers.phase2?.pexemptScope==='unknown')vatLabel+=' — étendue indéterminée';
    items.push(['TVA',vatLabel]);
  }
  if(!items.length)return '';
  return `<div class="answer-recap" aria-label="Pense-bête de vos réponses déjà renseignées"><div class="answer-recap-title">Pense-bête</div>${items.map(([label,value])=>`<div class="answer-recap-line"><strong>${label} :</strong> ${esc(value)}</div>`).join('')}</div>`;
}
function render(){
  document.querySelector('.nav-buttons').classList.remove('hidden');
  const qs=currentQuestions(),q=qs[step];
  $('progressText').textContent=`Diagnostic — question ${step+1} sur ${qs.length}`;
  $('progressBar').style.width=`${(step+1)/qs.length*100}%`;
  const recap=recapForStep(step);
  $('question').innerHTML=`${recap}<h1>${q.text}</h1>${q.help?`<p class="small">${q.help}</p>`:""}${q.id==="vat"?`<p class="official-link"><a href="https://cfspart-idp.impots.gouv.fr/" target="_blank" rel="noopener">→ Accéder à votre espace professionnel sur impots.gouv.fr</a></p>`:""}`;
  $('answers').innerHTML="";
  const selected=answers[q.id]||[];
  q.options.forEach(([v,label])=>{const b=document.createElement('button');b.type='button';b.className='answer';if(q.multi&&selected.includes(v)||!q.multi&&selected===v)b.classList.add('selected');b.textContent=label;b.onclick=()=>{if(q.multi){let arr=Array.isArray(answers[q.id])?[...answers[q.id]]:[];if(v==='none'){arr=['none']}else{arr=arr.filter(x=>x!=='none');arr.includes(v)?arr=arr.filter(x=>x!==v):arr.push(v)}answers[q.id]=arr}else answers[q.id]=v;render()};$('answers').appendChild(b)});
  const has=q.multi?Array.isArray(answers[q.id])&&answers[q.id].length>0:!!answers[q.id];
  $('next').disabled=!has;
  $('back').classList.remove('hidden');
  $('back').disabled=step===0;
  $('next').textContent=(step===qs.length-1 && !(q.id==='vat'&&answers.vat==='exempt'))?'Voir ma fiche':'Continuer →';
}
function setPrecisionNavigation(canContinue){
  const nav=document.querySelector('.nav-buttons');
  const back=$('back'),next=$('next');
  if(!canContinue){
    nav.classList.add('hidden');
    return;
  }
  nav.classList.remove('hidden');
  back.disabled=false;
  next.disabled=false;
}
function showPrefilledCategory(category){
  mode='categoryResult';
  step=0;
  $('quiz').classList.remove('hidden');
  $('result').classList.add('hidden');
  $('answers').innerHTML='';
  $('progressText').textContent='Diagnostic — catégorie déjà renseignée';
  $('progressBar').style.width='20%';
  $('question').innerHTML=`<div class="result-box prefilled-category"><h1>Votre catégorie est : <strong>${esc(categoryLabels[category]||category)}</strong></h1><p class="small">Cette catégorie a été renseignée à partir des données publiques consultées pour votre SIRET.</p></div>`;
  const nav=document.querySelector('.nav-buttons');
  nav.classList.remove('hidden');
  $('back').classList.add('hidden');
  $('next').disabled=false;
  $('next').textContent='Continuer →';
}
function preciseCategory(){
  $('quiz').classList.remove('hidden');
  $('answers').innerHTML='';
  setPrecisionNavigation(false);
  $('result').classList.add('hidden');
  $('progressText').textContent='Précision de votre catégorie';
  $('progressBar').style.width='25%';
  $('question').innerHTML=`<h1>Préciser : votre catégorie d’entreprise</h1>
    <p class="small">La catégorie officielle peut dépendre de l’effectif, du chiffre d’affaires et du total du bilan. Nous allons utiliser ces critères pour vous aider à la déterminer.</p>
    <div id="catStep"></div>`;
  const state={effectif:null,ca:null,bilan:null};
  const catStep=$('catStep');

  function drawEffectif(){
    setPrecisionNavigation(false);
    catStep.innerHTML=`<div class="result-box">
      <h2>1. Combien de personnes travaillent dans votre entreprise ?</h2>
      <p class="small">Indiquez l’effectif de votre entreprise.</p>
      <div class="answers">
        <button class="answer" data-v="lt10">Moins de 10 personnes</button>
        <button class="answer" data-v="10_249">De 10 à 249 personnes</button>
        <button class="answer" data-v="250_4999">De 250 à 4 999 personnes</button>
        <button class="answer" data-v="5000plus">5 000 personnes ou plus</button>
      </div>
    </div>`;
    catStep.querySelectorAll('.answer').forEach(b=>b.onclick=()=>{
      state.effectif=b.dataset.v;
      if(state.effectif==='5000plus') finish('large');
      else drawFinancials();
    });
  }

  function drawFinancials(){
    setPrecisionNavigation(false);
    catStep.innerHTML=`<div class="result-box">
      <h2>2. Vos chiffres annuels</h2>
      <p class="small">Indiquez une tranche pour le chiffre d’affaires et pour le total du bilan de votre dernier exercice comptable clôturé.</p>
      <label class="field-label" for="catCA">Chiffre d’affaires annuel</label>
      <select id="catCA" class="text-input">
        <option value="">Sélectionnez une tranche</option>
        <option value="le2">2 M€ ou moins</option>
        <option value="2_10">Plus de 2 M€ et jusqu’à 10 M€</option>
        <option value="10_50">Plus de 10 M€ et jusqu’à 50 M€</option>
        <option value="50_1500">Plus de 50 M€ et jusqu’à 1,5 Md€</option>
        <option value="gt1500">Plus de 1,5 Md€</option>
      </select>
      <label class="field-label" for="catBilan">Total du bilan</label>
      <select id="catBilan" class="text-input">
        <option value="">Sélectionnez une tranche</option>
        <option value="le2">2 M€ ou moins</option>
        <option value="2_43">Plus de 2 M€ et jusqu’à 43 M€</option>
        <option value="43_2000">Plus de 43 M€ et jusqu’à 2 Md€</option>
        <option value="gt2000">Plus de 2 Md€</option>
      </select>
      <button id="catDetermine" class="primary">Déterminer ma catégorie →</button>
      <p id="catError" class="small"></p>
    </div>`;
    $('catDetermine').onclick=()=>{
      state.ca=$('catCA').value;
      state.bilan=$('catBilan').value;
      if(!state.ca||!state.bilan){$('catError').textContent='Veuillez renseigner les deux montants pour poursuivre.';return;}
      finish(classifyCategory(state));
    };
  }

  function finish(category){
    answers.size=category;
    const nav=document.querySelector('.nav-buttons');
    nav.classList.remove('hidden');
    $('back').classList.add('hidden');
    $('next').disabled=false;
    $('next').textContent='Continuer vers le questionnaire →';
    catStep.innerHTML=`<div class="result-box">
      <h2>Votre catégorie est « ${categoryLabels[category]} »</h2>
      <p class="small">Cette catégorie a été déterminée à partir de l’effectif, du chiffre d’affaires et du total du bilan du dernier exercice comptable clôturé.</p>
    </div>`;
    mode='categoryResult';
  }

  drawEffectif();
}
function classifyCategory(s){
  const ca=s.ca,b=s.bilan,e=s.effectif;
  // Official hierarchy: micro ⊂ PME ⊂ ETI. The tests use the three
  // independent criteria: headcount, turnover and balance sheet total.
  const isMicro=e==='lt10'&&(ca==='le2'||b==='le2');
  if(isMicro)return 'small';
  const isPme=(e==='lt10'||e==='10_249')&&
    (['le2','2_10','10_50'].includes(ca)||['le2','2_43'].includes(b));
  if(isPme)return 'pme';
  const isEti=(e==='lt10'||e==='10_249'||e==='250_4999')&&
    (['le2','2_10','10_50','50_1500'].includes(ca)||['le2','2_43','43_2000'].includes(b));
  if(isEti)return 'eti';
  return 'large';
}
$('next').onclick=()=>{
  if(mode==='categoryResult'){step=1;mode='main';$('back').classList.remove('hidden');render();return;}
  const qs=currentQuestions(),q=qs[step];
  if(q&&q.id==='size'&&answers.size==='unknown'){preciseCategory();return;}
  if(q&&q.id==='vat'&&answers.vat==='exempt'){showPhase2(false);return;}
  if(step<qs.length-1){step++;render()}else showResult();
};
$('back').onclick=()=>{
  if(mode==='categoryResult'){step=0;mode='main';$('back').classList.remove('hidden');render();return;}
  if(step>0){step--;render()}
};
function hasClient(v){const c=answers.clients||[];return c.includes(v)}
function getClientLabels(){
 const out=[];if(hasClient('business_fr'))out.push('des entreprises ou professionnels en France (B2B)');if(hasClient('business_foreign'))out.push('des entreprises ou professionnels à l’étranger (B2B international)');if(hasClient('public'))out.push('des collectivités publiques ou organismes publics');if(hasClient('private'))out.push('des particuliers (B2C)');return out;
}
function joinFr(items){if(items.length<2)return items[0]||'';if(items.length===2)return items[0]+' et '+items[1];return items.slice(0,-1).join(', ')+' et '+items.at(-1)}
function buildObligations(a){
 const b2b=hasClient('business_fr'),foreign=hasClient('business_foreign'),public=hasClient('public'),b2c=hasClient('private');
 const services=['services','both'].includes(a.activity), goods=['goods','both'].includes(a.activity);
 const isLarge=['eti','large'].includes(a.size), isSmall=['small','pme'].includes(a.size);
 const emissionDate=isLarge?'1er septembre 2026':isSmall?'1er septembre 2027':'à préciser';
 const erDate=isLarge?'1er septembre 2026':isSmall?'1er septembre 2027':'à préciser';
 const exemptionScope=a.vat==='exempt'?(a.phase2||{}).pexemptScope:null;
 const fullyExempt=exemptionScope==='all';
 const exemptionUndetermined=a.vat==='exempt' && (!exemptionScope || exemptionScope==='unknown');
 const inScope= !fullyExempt && !exemptionUndetermined;
 const paymentReportingAllowed=['franchise','simplified','real_month'].includes(a.vat);
 const obligations={
   receive:true,
   eInvoicing:inScope&&b2b,
   eReportingTransaction:inScope&&(b2c||foreign),
   eReportingPayment:inScope&&services&&paymentReportingAllowed,
   eReportingPaymentDate:inScope&&paymentReportingAllowed?erDate:null,
   emissionDate:inScope?emissionDate:null,
   eReportingDate:inScope?erDate:null,
   publicCircuit:public,
   goods,services,
   paymentNeedsQualification:inScope&&services,
   exemptionNeedsValidation:a.vat==='exempt',
   exemptionScope,
   fullyExempt,
   exemptionUndetermined,
   exemptionPartial:exemptionScope==='some'
 };
 return obligations;
}
function obligationIsAlreadyApplicable(date){return date==='1er septembre 2026'}
function complianceAlertNeeded(o){return (o.eInvoicing&&obligationIsAlreadyApplicable(o.emissionDate))||(o.eReportingTransaction&&obligationIsAlreadyApplicable(o.eReportingDate))||(o.eReportingPayment&&obligationIsAlreadyApplicable(o.eReportingPaymentDate))}
function actionVerb(date){return obligationIsAlreadyApplicable(date)?'vérifiez que la mise en œuvre est effective':'préparez la mise en œuvre'}
function accountingValidationNeeded(a,o){
 return a.vat==='exempt'||a.vat==='unknown'||hasClient('public')||hasClient('business_foreign')||(hasClient('business_fr')&&hasClient('private'))||a.billing==='no'||a.activity==='services'||a.activity==='both';
}
function accountingValidationItems(a,o){
 const items=[];
 if(o.receive)items.push('réception des factures électroniques (e-invoicing)');
 if(o.eInvoicing)items.push('émission des factures électroniques (e-invoicing) pour les entreprises ou professionnels en France (B2B)');
 if(o.eReportingTransaction)items.push('transmission des données de transaction à l’administration (e-reporting)');
 if(o.eReportingPayment)items.push('transmission des données de paiement et règles d’exigibilité de la TVA (notamment TVA sur les débits / autoliquidation)');
 if(a.vat==='exempt'||a.vat==='unknown')items.push('régime de TVA et opérations exonérées ou particulières');
 if(o.publicCircuit)items.push('circuit de facturation du secteur public / Chorus Pro');
 return items;
}
function pdfContext(a){
 const o=buildObligations(a);
 const b2b=o.eInvoicing,foreign=o.eReportingTransaction&&hasClient('business_foreign'),b2c=o.eReportingTransaction&&hasClient('private'),public=hasClient('public');
 const parts=[];
 if(b2b)parts.push({icon:'🏢',label:'Entreprises / professionnels en France (B2B)',text:'Un PDF envoyé simplement par e-mail peut constituer une facture sous forme de PDF, mais il ne constitue pas une facture électronique (e-invoicing) au sens de la réforme. Pour les opérations concernées, la facture électronique doit être émise et transmise selon le dispositif prévu par la réforme, via une plateforme agréée (PA).'});
 if(foreign)parts.push({icon:'🌍',label:'Entreprises / professionnels à l’étranger (B2B international)',text:'Pour ces opérations, vous n’avez pas à émettre une facture électronique (e-invoicing) au titre de la réforme française. En revanche, les données des opérations concernées doivent être transmises électroniquement à l’administration dans le cadre de la transmission des données de transaction (e-reporting). Les modalités habituelles de facturation de vos clients internationaux restent applicables.'});
 if(b2c)parts.push({icon:'👤',label:'Particuliers (B2C)',text:'Pour ces opérations, vous pouvez continuer à remettre votre facture au particulier selon les modalités habituelles adaptées à votre activité, notamment par courrier ou au format PDF par courriel. ⚠️ EN REVANCHE, les données des opérations concernées doivent être transmises électroniquement à l’administration dans le cadre de la transmission électronique des données (e-reporting).'});
 if(public)parts.push({icon:'🏛️',label:'Secteur public',text:'La facture suit le circuit électronique prévu pour les entités publiques, notamment via une plateforme agréée raccordée à Chorus Pro ou, pendant la période transitoire, via Chorus Pro directement.'});
 return parts;
}
function reportingFrequency(vat,kind){
 const map={
  transaction:{franchise:'Bimestrielle (tous les 2 mois)',simplified:'Mensuelle',real_quarter:'Mensuelle',real_month:'Par décade (3 dépôts par mois)'},
  payment:{franchise:'Bimestrielle (tous les 2 mois)',simplified:'Mensuelle',real_quarter:null,real_month:'Mensuelle'}
 };
 if(vat==='unknown')return null;
 return map[kind]?.[vat]??null;
}
function reportingFrequencyBlock(a,o){
 if(a.vat==='unknown' && (o.eReportingTransaction||o.eReportingPayment)){
  return `<div class="result-box warning"><h2>Fréquences de transmission : régime de TVA à préciser</h2><p>Votre régime de TVA détermine la fréquence de transmission des données. U GREGALE ne choisit pas une fréquence à votre place.</p><ul><li><strong>Franchise en base :</strong> données de transaction et de paiement bimestrielles.</li><li><strong>Régime simplifié :</strong> données de transaction et de paiement mensuelles.</li><li><strong>Régime réel normal trimestriel :</strong> données de transaction mensuelles ; pas de transmission de données de paiement prévue dans le tableau officiel.</li><li><strong>Régime réel normal mensuel :</strong> données de transaction par décade (3 dépôts par mois) et données de paiement mensuelles.</li></ul><p>Consultez votre espace professionnel sur impots.gouv.fr, via le service « Déclarer la TVA », pour déterminer votre régime.</p></div>`;
 }
 const items=[];
 if(o.eReportingTransaction){const f=reportingFrequency(a.vat,'transaction');if(f)items.push(`<li><strong>Données de transaction (e-reporting) :</strong> ${f}.</li>`);}
 if(o.eReportingPayment){const f=reportingFrequency(a.vat,'payment');if(f)items.push(`<li><strong>Données de paiement (e-reporting) :</strong> ${f}.</li>`);}
 if(!items.length)return '';
 return `<div class="result-box"><h2>Fréquence de transmission</h2><ul>${items.join('')}</ul></div>`;
}
function showResult(){
 $('quiz').classList.add('hidden');$('result').classList.remove('hidden');
 const a=answers,o=buildObligations(a),sizeLabel=categoryLabels[a.size]||'catégorie d’entreprise à préciser',clientLabels=getClientLabels(),public=hasClient('public');
 const activityLabels={goods:'la vente de marchandises',services:'les prestations de services',both:'la vente de marchandises et les prestations de services',};
 const vatLabels={franchise:'bénéficiaire de la franchise en base de TVA',simplified:'au régime simplifié d’imposition de la TVA',real_quarter:'au régime réel normal de TVA avec déclaration trimestrielle',real_month:'au régime réel normal de TVA avec déclaration mensuelle',exempt:'une activité bénéficiant d’une exonération particulière',unknown:'un régime de TVA à préciser'};
 const siretInfo=answers.siretInfo||window.siretLookup||{};
 const companyName=siretInfo.r?.nom_complet||siretInfo.r?.nom_raison_sociale||'';
 const siret=siretInfo.siret||a.siret||'';
 const billingText=a.billing==='no'?'Vous indiquez qu’aucune prestation ni vente n’a encore été effectuée.': 'Vous émettez actuellement des factures.';
 let blocks=[];
  blocks.push(`<div class="result-box intro-box"><p>Cette feuille de route est établie à partir des informations que vous avez fournies dans le diagnostic U GREGALE. Elle vous permet d’identifier les principales obligations et actions à prévoir pour votre entreprise.</p><p>Elle constitue un outil d’orientation et d’aide à la décision, et ne remplace pas une analyse comptable, fiscale ou juridique lorsque celle-ci est nécessaire.</p></div>`);
 const siretBlock=(siretInfo.r&&siret)?`<div class="siret-result-info"><h3>Informations publiques consultées à partir du SIRET</h3><ul class="situation-list"><li><strong>Entreprise :</strong> ${esc(companyName||'Entreprise')}</li><li><strong>SIRET :</strong> ${esc(siret)}</li><li><strong>État :</strong> ${((siretInfo.r?.etat_administratif==='A'||siretInfo.e?.etat_administratif==='A')?'En activité':'À vérifier : établissement non actif')}</li><li><strong>Catégorie INSEE :</strong> ${esc(siretInfo.r?.categorie_entreprise||'Non renseignée')}</li><li><strong>Activité principale :</strong> ${esc(siretInfo.e?.activite_principale||siretInfo.r?.activite_principale||'Non renseignée')}${siretInfo.e?.activite_principale_naf25?` <span class="small">(NAF 2025 : ${esc(siretInfo.e.activite_principale_naf25)})</span>`:''}</li><li><strong>Adresse :</strong> ${esc(siretInfo.e?.adresse||siretInfo.r?.siege?.adresse||'Non renseignée')}</li>${(Array.isArray(siretInfo.r?.tva)?siretInfo.r.tva.join(', '):(siretInfo.r?.tva||''))?`<li><strong>N° TVA intracommunautaire :</strong> ${esc(Array.isArray(siretInfo.r.tva)?siretInfo.r.tva.join(', '):siretInfo.r.tva)}</li>`:''}</ul><p class="small">Ces données publiques servent à personnaliser le diagnostic. Elles ne permettent pas de déduire votre régime de TVA ni vos types de clients.</p></div>`:'';
 blocks.push(`<div class="result-box"><h2>Votre situation</h2>${siretBlock}<ul class="situation-list"><li>Catégorie : <strong>${esc(sizeLabel)}</strong></li><li>Clients ou futurs clients : <strong>${esc(joinFr(clientLabels)||'à préciser')}</strong></li><li>${esc(billingText)}</li>${a.activity?`<li>Activité : ${esc(activityLabels[a.activity])}</li>`:''}${a.vat?`<li>TVA : ${esc(vatLabels[a.vat])}</li>`:''}${hasClient('public')?`<li><strong>Secteur public :</strong> pour les factures destinées aux entités publiques, le circuit Chorus Pro reste applicable. Depuis le 1er septembre 2026, le fournisseur peut utiliser soit une plateforme agréée raccordée à Chorus Pro, soit continuer à utiliser directement Chorus Pro pendant la période transitoire ; certaines opérations conservent des modalités propres à Chorus Pro.</li>`:''}</ul></div>`);
 const concerned=[];
 if(o.receive)concerned.push(`Réception des factures électroniques : toutes les entreprises assujetties à la TVA doivent être en capacité de recevoir des factures électroniques ${DATE_2026}.`);
 if(o.eInvoicing)concerned.push(`Facturation électronique (e-invoicing) pour les factures adressées aux entreprises ou professionnels établis en France (B2B) : émission ${dateLabel(o.emissionDate)}.`);
 if(o.eReportingTransaction){
    const transactionClients=[];
    if(hasClient('private'))transactionClients.push('des particuliers (B2C)');
    if(hasClient('business_foreign'))transactionClients.push('des entreprises / professionnels à l’étranger (B2B international)');
    const transactionTarget=transactionClients.length===1?transactionClients[0]:joinFr(transactionClients);
    concerned.push(`Transmission des données de transaction à l’administration (e-reporting) pour les opérations avec ${transactionTarget} concernées : échéance ${dateLabel(o.eReportingDate)}.`);
  }
 if(o.eReportingPayment)concerned.push(`Transmission des données de paiement à l’administration (e-reporting de paiement) : vos prestations de services peuvent être concernées. Cette obligation dépend notamment de l’exigibilité de la TVA ; les opérations autoliquidées et celles pour lesquelles vous avez opté pour la TVA sur les débits font l’objet de règles particulières. Échéance : ${dateLabel(o.eReportingPaymentDate)}.`);
 if(o.publicCircuit)concerned.push('Facturation au secteur public : circuit électronique spécifique avec Chorus Pro, selon les modalités applicables à l’opération.');
 if(a.billing==='no')concerned.push('Vous n’émettez pas encore de factures : les obligations d’émission et de transmission liées à vos futures opérations doivent être préparées selon votre clientèle prévue ; votre obligation de réception électronique reste à prendre en compte si vous êtes assujetti à la TVA.');
 blocks.push(`<div class="result-box"><h2>Ce qui vous concerne</h2><ul>${concerned.map(x=>`<li>${x}</li>`).join('')}</ul></div>`);
 blocks.push(reportingFrequencyBlock(a,o));
 // Actions are strictly derived from the obligation object.
 const actions=[];
 actions.push(`<strong>Votre solution de facturation :</strong> vérifiez, auprès de l’éditeur, que votre logiciel de facturation ou votre solution actuelle est compatible avec les obligations qui vous concernent et peut être raccordé à votre plateforme agréée (PA), si nécessaire. <button type="button" class="info-trigger" aria-expanded="false" aria-controls="softwareInfo" title="Vigilance sur les possibilités de votre logiciel">ⓘ</button><span id="softwareInfo" class="info-popover hidden" role="note"><strong>À vérifier avec votre logiciel de facturation</strong> <br> Si vous facturez, ou envisagez de facturer, différents types de clients — entreprises ou professionnels en France (B2B), particuliers (B2C), entreprises ou professionnels à l’étranger (B2B international), secteur public — vérifiez que votre solution permet de gérer les différents circuits de facturation qui peuvent s’appliquer. <br><br> <strong>Cela ne signifie pas nécessairement que vous devez changer de logiciel :</strong> vérifiez d’abord ses possibilités d’évolution et, le cas échéant, sa compatibilité avec une plateforme agréée (PA).</span>`);
 if(o.eInvoicing)actions.push(`<strong>Facturation électronique (e-invoicing) :</strong> ${actionVerb(o.emissionDate)} pour l’émission des factures destinées aux entreprises / professionnels en France (B2B) ${dateLabel(o.emissionDate)}. <button type="button" class="info-trigger" aria-expanded="false" aria-controls="eInvoicingInfo" title="Quelles opérations sont concernées ?">ⓘ</button><span id="eInvoicingInfo" class="info-popover hidden" role="note"><strong>Quelles opérations sont concernées ?</strong><br>Ce volet concerne les opérations de vente de biens et de prestations de services réalisées avec des entreprises ou professionnels établis en France (B2B), lorsqu’elles entrent dans le champ de la réforme.<br><br><strong>Pour ces opérations,</strong> la facture électronique doit être émise et transmise dans le cadre du dispositif de la réforme, par l’intermédiaire d’une plateforme agréée (PA), directement ou au travers d’une solution de facturation compatible.<br><br>Les opérations avec des particuliers (B2C), avec des professionnels à l’étranger (B2B international) ou avec le secteur public suivent, selon les cas, des circuits ou modalités spécifiques.</span>`);
 if(o.eReportingTransaction)actions.push(`<strong>Transmission des données de transaction (e-reporting) :</strong> ${actionVerb(o.eReportingDate)} pour la transmission des opérations concernées ${dateLabel(o.eReportingDate)}.`);
 if(o.eReportingPayment)actions.push(`<strong>Transmission des données de paiement :</strong> ${actionVerb(o.eReportingPaymentDate)} pour les prestations concernées ${dateLabel(o.eReportingPaymentDate)}.`);
 if(o.publicCircuit)actions.push('<strong>Secteur public :</strong> si vous facturez des collectivités ou organismes publics, vérifiez que la solution retenue permet le circuit vers Chorus Pro : plateforme agréée raccordée à Chorus Pro, ou utilisation directe de Chorus Pro pendant la période transitoire. Certaines catégories de factures conservent des modalités propres à Chorus Pro.');
 
 const pdfs=pdfContext(a);
 const complianceAlert=complianceAlertNeeded(o)?`<p class="compliance-alert"><strong>ATTENTION :</strong> certaines obligations indiquées ci-dessous sont déjà applicables <strong>DEPUIS LE 1er SEPTEMBRE 2026</strong>. Si leur mise en œuvre n’est pas encore effective, vérifiez votre situation et les actions à engager. <a href="#sanctions">Voir « ATTENTION : En cas de non-conformité »</a>.</p>`:'';
 blocks.push(`<div class="result-box"><h2>Ce que vous devez faire</h2>${complianceAlert}<ol>${actions.map(x=>`<li>${x}</li>`).join('')}</ol></div>`);
 if(pdfs.length)blocks.push(`<div class="result-box format-box"><h2>Formats de facture</h2><div class="format-guidance">${pdfs.map(p=>`<div class="format-item"><h3>${p.icon} ${esc(p.label)}</h3><p>${esc(p.text)}</p></div>`).join('')}</div></div>`);
 const when=[];when.push(`<strong>${DATE_2026} :</strong> capacité à recevoir des factures électroniques pour les entreprises assujetties à la TVA.`);
 if(o.eInvoicing)when.push(`<strong>${dateLabel(o.emissionDate)} :</strong> émission électronique pour les factures adressées aux entreprises ou professionnels en France (B2B) entrant dans le champ de la réforme.`);
 if(o.eReportingTransaction)when.push(`<strong>${dateLabel(o.eReportingDate)} :</strong> transmission des données de transaction pour les opérations concernées.`);
 if(o.eReportingPayment)when.push(`<strong>${dateLabel(o.eReportingPaymentDate)} :</strong> transmission des données de paiement pour les prestations concernées, sous réserve des règles d’exigibilité de la TVA applicables à vos opérations.`);
 if(o.publicCircuit)when.push('<strong>Secteur public :</strong> le dispositif de facturation électronique existe déjà ; ne pas présenter le 1er septembre 2027 comme le début de cette obligation.');
 blocks.push(`<div class="result-box"><h2>Quand ?</h2><ul>${when.map(x=>`<li>${x}</li>`).join('')}</ul></div>`);
 if(a.vat==='franchise')blocks.push(`<div class="result-box"><h2>Votre TVA : franchise en base</h2><p>La franchise en base ne vous met pas, à elle seule, hors du champ de la réforme. Les obligations dépendent aussi de vos opérations et de votre clientèle.</p></div>`);
 if(['simplified','real_quarter','real_month'].includes(a.vat))blocks.push(`<div class="result-box"><h2>Votre TVA</h2><p>Votre régime de TVA est pris en compte avec votre clientèle et la nature de vos opérations pour déterminer les transmissions à effectuer.</p></div>`);
 if(a.vat==='unknown')blocks.push(`<div class="result-box warning"><h2>Votre régime de TVA reste à préciser</h2><p>Connectez-vous à votre espace professionnel sur impots.gouv.fr, puis accédez au service « Déclarer la TVA » pour consulter votre régime de TVA.</p><p><a href="https://cfspart-idp.impots.gouv.fr/" target="_blank" rel="noopener">→ ACCÉDER À MON ESPACE PROFESSIONNEL ↗</a></p></div>`);
 if(o.paymentNeedsQualification)blocks.push(`<div class="result-box warning"><h2>Point particulier : données de paiement</h2><p>Le diagnostic identifie des prestations de services. La transmission des données de paiement à l’administration dépend notamment de l’exigibilité de la TVA. Vérifiez en particulier si vous avez opté pour la TVA sur les débits ou si certaines opérations donnent lieu à autoliquidation.</p></div>`);
 if(a.vat==='exempt'){
  const p2=a.phase2||{};
  const scopeLabel={all:'Toutes vos opérations',some:'Seulement certaines opérations',unknown:'Étendue de l’exonération encore indéterminée'}[p2.pexemptScope];
  const natureLabel={health:'Santé / activités médicales ou paramédicales',education:'Enseignement / formation',finance:'Activités financières / assurance',nonprofit:'Association ou organisme sans but lucratif',realestate:'Certaines opérations immobilières',other:'Autre situation / qualification à préciser'}[p2.pexemptNature];
  if(p2.pexemptScope==='all'){
    blocks.push(`<div class="result-box warning"><h2>Exonération de TVA : toutes les opérations déclarées exonérées</h2><p>Vous indiquez que l’exonération concerne <strong>toutes vos opérations</strong>.</p><p>Sous réserve que l’exonération relève bien des opérations exonérées et dispensées de facturation visées par les règles de la réforme, ces opérations sont hors champ en émission de la facturation électronique (e-invoicing) et du e-reporting.</p><p><strong>La réception des factures électroniques de vos fournisseurs reste toutefois à prendre en compte.</strong></p><p>Cette réponse constitue une orientation et ne vaut pas qualification juridique de l’exonération. Faites-la valider avec votre service comptabilité ou votre expert-comptable.</p><button class="inline-phase2" id="phase2exempt">Modifier mon exonération</button></div>`);
  }else if(p2.pexemptScope==='some'){
    blocks.push(`<div class="result-box warning"><h2>Exonération de TVA : certaines opérations seulement</h2><p><strong>Étendue :</strong> ${esc(scopeLabel)}</p>${natureLabel?`<p><strong>Nature indiquée :</strong> ${esc(natureLabel)}</p>`:''}<p>Les obligations affichées portent sur les opérations susceptibles d’entrer dans le champ de la réforme. Les opérations exonérées peuvent relever d’un traitement différent selon leur nature et les conditions applicables.</p><p>Cette réponse constitue une orientation et ne vaut pas qualification juridique de l’exonération. Faites-la valider avec votre service comptabilité ou votre expert-comptable.</p><button class="inline-phase2" id="phase2exempt">Modifier mon exonération</button></div>`);
  }else if(p2.pexemptScope==='unknown'){
    blocks.push(`<div class="result-box warning"><h2>Exonération de TVA : qualification à confirmer</h2><p><strong>Étendue :</strong> ${esc(scopeLabel||'à préciser')}</p><p>La qualification du périmètre de l’exonération doit être déterminée avant de considérer les obligations d’émission et de transmission comme définitivement établies.</p><p>U GREGALE ne tranche pas juridiquement cette qualification à partir du seul questionnaire. Faites-la valider avec votre service comptabilité ou votre expert-comptable.</p><button class="inline-phase2" id="phase2exempt">Préciser mon exonération</button></div>`);
  }else{
    blocks.push(`<div class="result-box warning"><h2>Exonération de TVA : vérification nécessaire</h2><p>Une exonération particulière peut modifier l’analyse selon la nature exacte des opérations et les conditions applicables. U GREGALE ne tranche pas juridiquement cette qualification à partir du seul questionnaire.</p><button class="inline-phase2" id="phase2exempt">Préciser mon exonération</button></div>`);
  }
}
 const accountingItems=accountingValidationItems(a,o);
 if(accountingValidationNeeded(a,o)&&accountingItems.length)blocks.push(`<div class="result-box"><h2>À faire valider avec votre comptabilité</h2><p>Lorsque plusieurs règles se croisent ou qu’une qualification reste incertaine, faites vérifier les points suivants avec votre service comptabilité ou votre expert-comptable.</p><ul>${accountingItems.map(x=>`<li>${x} ;</li>`).join('')}</ul></div>`);
 const summary=[];if(o.eInvoicing)summary.push('facturation électronique (e-invoicing) pour les entreprises / professionnels en France (B2B)');if(o.eReportingTransaction)summary.push('transmission des données de transaction (e-reporting)');if(o.eReportingPayment)summary.push('un possible e-reporting de paiement pour vos prestations de services, à confirmer selon les règles d’exigibilité de la TVA');if(o.publicCircuit)summary.push('circuit secteur public / Chorus Pro');
 blocks.push(`<div class="result-box"><h2>À retenir pour votre entreprise</h2><p>${summary.length?'Votre diagnostic fait ressortir : <strong>'+esc(joinFr(summary))+'</strong>.':'Aucun volet d’émission ou de transmission n’a pu être déterminé à partir des réponses fournies.'}</p><p>${a.billing==='no'?'Votre entreprise n’a encore émis aucune facture : préparez maintenant le bon circuit pour votre future clientèle, sans présenter une émission actuelle comme déjà réalisée.':'Les obligations ci-dessus sont celles déduites de vos réponses ; les modalités particulières doivent être validées lorsqu’une vérification comptable est recommandée.'}</p></div>`);
 blocks.push(`<div class="result-box warning" id="sanctions"><h2>⚠️ En cas de non-conformité</h2><p>Un manquement à certaines obligations liées à la facturation électronique et à la transmission des données peut entraîner des sanctions financières. Une première infraction peut, dans certaines conditions, ne pas être sanctionnée lorsqu’elle est régularisée dans les conditions prévues.</p><p><a class="sanctions-link" href="https://entreprendre.service-public.gouv.fr/actualites/A18802" target="_blank" rel="noopener">→ Consulter les sanctions officielles sur Service-Public.fr ↗</a></p></div>`);
 const officialResources=[
   {title:'Fiche officielle « Qu’est-ce que ça change pour moi ? »',href:'https://www.impots.gouv.fr/facturation-electronique-qu-est-ce-que-ca-change-pour-moi'},
   {title:'Liste officielle des plateformes agréées',href:'https://www.impots.gouv.fr/je-consulte-la-liste-des-plateformes-agreees'},
   {title:'Guide officiel de la réforme',href:'https://www.impots.gouv.fr/professionnel/je-passe-la-facturation-electronique'}
 ];
 if(public)officialResources.push({title:'Informations officielles sur Chorus Pro et le secteur public',href:'https://www.impots.gouv.fr/actualite/chorus-pro-restera-la-plateforme-de-reference-pour-la-facturation-electronique-du-secteur'});
 if(a.vat==='exempt')officialResources.push({title:'Informations officielles sur les opérations exonérées et la réforme',href:'https://www.impots.gouv.fr/professionnel/questions/je-nemets-pas-de-facture-ou-je-facture-sans-tva-suis-je-concerne-par-la'});
 const officialHtml=officialResources.map(r=>`<li><a href="${r.href}" target="_blank" rel="noopener">${esc(r.title)} ↗</a><div class="official-url">${esc(r.href)}</div></li>`).join('');
 blocks.push(`<div class="result-box official-box" id="officialResources"><h2>Informations officielles adaptées à votre situation</h2><p>Pour aller plus loin, vous pouvez consulter les ressources officielles suivantes :</p><ul class="official-resources">${officialHtml}</ul><p class="official-footer">Fiche à jour au ${FICHE_DATE} — Les textes et ressources de l’administration font foi.<br>U GREGALE est un outil d’orientation pratique.</p></div>`);
 $('result').innerHTML=`<h1>Votre feuille de route personnalisée</h1><p class="fiche-credit">Réalisée par U GREGALE</p><p class="small fiche-date"><strong>Vérification réglementaire : ${FICHE_DATE}</strong></p>${blocks.join('')}<div class="actions"><button id="pdf">⬇️ Enregistrer ma fiche en PDF</button><button class="secondary" id="print">🖨️ Imprimer ma fiche</button><button class="secondary" id="restart">Refaire le diagnostic</button></div>`;
 $('pdf').onclick=downloadPdf;$('print').onclick=()=>window.print();$('restart').onclick=restart;['phase2exempt'].forEach(id=>{const el=$(id);if(el)el.onclick=showPhase2;});
  const infoPairs=[['softwareInfo','Vigilance sur les possibilités de votre logiciel'],['eInvoicingInfo','Quelles opérations sont concernées ?']];
  infoPairs.forEach(([id,title])=>{
    const infoPopover=$(id);
    const infoTrigger=infoPopover?.previousElementSibling;
    if(infoTrigger&&infoPopover){
      infoTrigger.onclick=()=>{
        const open=infoPopover.classList.toggle('hidden')===false;
        infoTrigger.setAttribute('aria-expanded',String(open));
      };
    }
  });
}
function showPhase2(fromResult=true,startIndex=0,scopeOverride=null){
  const qs=[];
  if(answers.vat==='exempt'){
    qs.push({id:'pexemptScope',text:'Cette exonération concerne-t-elle toutes vos opérations ?',help:'Cette réponse permet de distinguer une exonération portant sur toute l’activité d’une exonération ne concernant que certaines opérations.',options:[['all','Oui, toutes mes opérations'],['some','Non, seulement certaines opérations'],['unknown','Je ne peux pas encore le déterminer']]});
    const existingScope=(answers.phase2||{}).pexemptScope;
    const effectiveScope=scopeOverride??existingScope;
    if(effectiveScope && effectiveScope!=='all'){
      qs.push({id:'pexemptNature',text:'Quelle est la nature de l’activité ou des opérations concernées ?',help:'Choisissez la catégorie qui se rapproche le plus de votre situation. Cette réponse ne vaut pas qualification juridique de l’exonération.',options:[['health','Santé / activités médicales ou paramédicales'],['education','Enseignement / formation'],['finance','Activités financières / assurance'],['nonprofit','Association ou organisme sans but lucratif'],['realestate','Certaines opérations immobilières'],['other','Autre situation / qualification à préciser']]});
    }
  }
  if(!qs.length){showResult();return}
  const returnToResult=fromResult;
  $('quiz').classList.add('hidden');$('result').classList.remove('hidden');
  let i=Math.min(startIndex,Math.max(0,qs.length-1)),pa={...(answers.phase2||{})};
  function draw(){
    const q=qs[i],selected=pa[q.id];
    const isScopeQuestion=q.id==='pexemptScope';
    const isLast=i===qs.length-1;
    const nextLabel=(isLast && !isScopeQuestion)?'Visualiser ma fiche':'Continuer →';
    const recap=recapForStep(5);
    $('result').innerHTML=`${recap}<span class="eyebrow">PRÉCISER VOTRE SITUATION</span><h1>${q.text}</h1>${q.help?`<p class="small">${q.help}</p>`:''}<div class="answers">${q.options.map(([v,l])=>`<button class="answer ${selected===v?'selected':''}" data-v="${v}">${l}</button>`).join('')}</div><div class="nav-buttons"><button class="secondary" id="pback">← ${returnToResult?'Retour à ma fiche':'Retour à la question TVA'}</button><button id="pnext" ${selected?'':'disabled'}>${nextLabel}</button></div>`;
    document.querySelectorAll('#result [data-v]').forEach(b=>b.onclick=()=>{pa[q.id]=b.dataset.v;draw()});
    $('pback').onclick=()=>{if(returnToResult){showResult();}else{$('result').classList.add('hidden');$('quiz').classList.remove('hidden');step=4;mode='main';render();}};
    $('pnext').onclick=()=>{
      answers.phase2=pa;
      if(q.id==='pexemptScope'){
        if(pa.pexemptScope==='all'){
          // Une exonération couvrant toutes les opérations ne nécessite pas de question sur la nature de ces opérations.
          showResult();
          return;
        }
        // Pour une exonération partielle ou encore indéterminée, la nature des opérations doit être précisée.
        showPhase2(returnToResult,1,pa.pexemptScope);return;
      }
      if(i<qs.length-1){i++;draw();return;}
      showResult();
    };
  }
  draw();
}
function cleanPdfText(text){
 return String(text||'')
   .replace(/[“”«»]/g,'"')
   .replace(/[’]/g,"'")
   .replace(/→/g,'>')
   .replace(/—/g,'-')
   .replace(/–/g,'-')
   .replace(/•/g,'-')
   .replace(/⚠️/g,'ATTENTION :')
   .replace(/[\uFE0F\u200D]/gu,'')
   // jsPDF/Helvetica ne gère pas les pictogrammes Unicode : on les supprime du PDF.
   .replace(/[\u{1F000}-\u{1FAFF}\u{1FC00}-\u{1FFFF}\u{2600}-\u{27BF}]/gu,'')
   .replace(/\s{2,}/g,' ');
}
function downloadPdf(){
  // Le navigateur fournit déjà une sortie PDF propre via son moteur d’impression.
  // On utilise donc exactement le même rendu que le bouton « Imprimer ».
  window.print();
}
function restart(){$("result").classList.add("hidden");$("quiz").classList.add("hidden");$("intro").classList.remove("hidden");$("siretBox").classList.add("hidden");$("siret").value="";step=0;answers={};mode="main"}
render();
