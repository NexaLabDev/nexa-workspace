import fs from 'node:fs';

let s = fs.readFileSync('components/nexa/remoto.ts', 'utf8');

if (!s.includes('assinaturaBase')) {
  s = s.replace(
    "let ocupado=false,geracao=0,mudanca=0,estado='Carregando…',pronto=false,bloqueado=false;",
    "let ocupado=false,geracao=0,mudanca=0,estado='Carregando…',pronto=false,bloqueado=false;\nlet assinaturaBase='';",
  );
}

const helper = `
/** Assinatura barata: muda só quando o servidor altera versão/ordem/presença. */
function assinarMapa(m:Map<string,Registro>):string{
 let out=String(m.size)+'|';
 for(const r of m.values()) out+=r.colecao+'\\0'+r.id+'\\0'+r.versao+'\\0'+r.ordem+'|';
 return out;
}
/** Igualdade estrutural: referência, depois listas por id, senão JSON normalizado. */
function mesmoValor(a:unknown,b:unknown):boolean{
 if(a===b)return true;
 if(a==null||b==null)return a===b;
 if(typeof a!==typeof b)return false;
 if(Array.isArray(a)&&Array.isArray(b)){
  if(a.length!==b.length)return false;
  for(let i=0;i<a.length;i++){
   const x=a[i] as Item|unknown,y=b[i] as Item|unknown;
   if(x&&y&&typeof x==='object'&&typeof y==='object'&&'id' in (x as object)&&'id' in (y as object)){
    if((x as Item).id!==(y as Item).id)return false;
    if(x!==y&&normalizar(x)!==normalizar(y))return false;
   }else if(x!==y&&normalizar(x)!==normalizar(y))return false;
  }
  return true;
 }
 if(typeof a==='object'&&typeof b==='object')return normalizar(a)===normalizar(b);
 return false;
}
`;

if (!s.includes('function assinarMapa')) {
  s = s.replace('export function normalizar(valor:unknown):string {', helper + '\nexport function normalizar(valor:unknown):string {');
}

s = s.replace(
  'base=new Map();pendentes=new Map();dados={};estado=',
  "base=new Map();pendentes=new Map();dados={};assinaturaBase='';estado=",
);

s = s.replace(
  'for(const c of Object.keys(novo))if(normalizar(novo[c])===normalizar(anterior[c]))novo[c]=anterior[c];',
  'for(const c of Object.keys(novo))if(mesmoValor(novo[c],anterior[c]))novo[c]=anterior[c];',
);

const oldAtualizar = `export async function atualizar(){
 if(!pessoa||ocupado||pendentes.size)return;
 const g=geracao,m=mudanca;
 try{
 const {data,error}=await supabaseNavegador().rpc('ler_registros');
 if(g!==geracao||m!==mudanca||pendentes.size)return;
 if(error||!Array.isArray(data))throw Error();
 base=new Map((data as Registro[]).map(r=>[mapa(r),r]));materializar();perfil={nome:pessoa.nome??pessoa.email,usuarioId:pessoa.id};pronto=true;estado='Salvo';avisar();
 }catch{if(g===geracao){estado='Falha ao atualizar. Tente novamente.';avisar();}}
}`;

const newAtualizar = `export async function atualizar(){
 if(!pessoa||ocupado||pendentes.size)return;
 const g=geracao,m=mudanca;
 try{
 const {data,error}=await supabaseNavegador().rpc('ler_registros');
 if(g!==geracao||m!==mudanca||pendentes.size)return;
 if(error||!Array.isArray(data))throw Error();
 const proximo=new Map((data as Registro[]).map(r=>[mapa(r),r]));
 const proxAssinatura=assinarMapa(proximo);
 // Sem mudança no servidor: não rematerializa nem acorda assinantes (exceto status)
 if(pronto && proxAssinatura===assinaturaBase){
  if(estado!=='Salvo'){estado='Salvo';avisar();}
  return;
 }
 base=proximo;assinaturaBase=proxAssinatura;materializar();
 perfil={nome:pessoa.nome??pessoa.email,usuarioId:pessoa.id};pronto=true;estado='Salvo';avisar();
 }catch{if(g===geracao){estado='Falha ao atualizar. Tente novamente.';avisar();}}
}`;

if (!s.includes('proxAssinatura')) {
  if (!s.includes(oldAtualizar)) throw new Error('atualizar block not found');
  s = s.replace(oldAtualizar, newAtualizar);
}

s = s.replace(
  'if(a && a.ordem===r.ordem && normalizar(a.conteudo)===normalizar(r.conteudo))continue;',
  'if(a && a.ordem===r.ordem && (a.conteudo===r.conteudo || mesmoValor(a.conteudo,r.conteudo)))continue;',
);

s = s.replace(
  'for(const [k,r] of [...pendentes]){const a=base.get(k);if(a&&normalizar(a.conteudo)===normalizar(r.conteudo))pendentes.delete(k);}',
  "assinaturaBase=assinarMapa(base);\n   for(const [k,r] of [...pendentes]){const a=base.get(k);if(a&&mesmoValor(a.conteudo,r.conteudo))pendentes.delete(k);}",
);

s = s.replace(
  'const a=base.get(k),igual=a&&a.ordem===r.ordem&&normalizar(a.conteudo)===normalizar(r.conteudo);',
  'const a=base.get(k),igual=a&&a.ordem===r.ordem&&mesmoValor(a.conteudo,r.conteudo);',
);

if (!s.includes("assinaturaBase=assinarMapa(base);\n estado=pendentes.size")) {
  s = s.replace(
    "estado=pendentes.size?'Salvando…':'Salvo';ocupado=false;if(pendentes.size)agendarEnvio();",
    "assinaturaBase=assinarMapa(base);\n estado=pendentes.size?'Salvando…':'Salvo';ocupado=false;if(pendentes.size)agendarEnvio();",
  );
}

s = s.replace(
  "if(a){if(normalizar(a.conteudo)!==normalizar(r.conteudo))throw Error('ID já existente com conteúdo diferente: '+c+'/'+r.id);continue;}",
  "if(a){if(!mesmoValor(a.conteudo,r.conteudo))throw Error('ID já existente com conteúdo diferente: '+c+'/'+r.id);continue;}",
);

s = s.replace(
  "for(const r of lote)if(normalizar(base.get(mapa(r))?.conteudo)!==normalizar(r.conteudo))throw Error('Não foi possível conferir '+r.id+'. Preserve o backup e tente novamente.');",
  "for(const r of lote)if(!mesmoValor(base.get(mapa(r))?.conteudo,r.conteudo))throw Error('Não foi possível conferir '+r.id+'. Preserve o backup e tente novamente.');",
);

if (!s.includes('Performance:')) {
  s = s.replace(
    '// As permissões valem no banco (RLS); aqui só evitamos tentativas inúteis.',
    '// As permissões valem no banco (RLS); aqui só evitamos tentativas inúteis.\n// Performance: poll sem mudança de versão não rematerializa nem acorda o React.',
  );
}

fs.writeFileSync('components/nexa/remoto.ts', s, 'utf8');
console.log({
  proxAssinatura: s.includes('proxAssinatura'),
  assinarMapa: s.includes('assinarMapa'),
  mesmoValor: s.includes('mesmoValor'),
  bytes: s.length,
});
