const SUPABASE_URL = 'https://tvezkcyhfupjzfwgjuze.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tPauTuj7i3OJVJNq-Wey8w_SzmL1pQW';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const views = {
  dashboard:'Dashboard',clientes:'Clientes',contratos:'Contratos',
  receber:'Contas a Receber',pagar:'Contas a Pagar',fluxo:'Fluxo de Caixa',
  dre:'DRE',rentabilidade:'Rentabilidade',kpis:'KPIs',
  centros:'Centros de Custo',usuarios:'Usuários'
};
const subs = {
  dashboard:'Visão geral',clientes:'Gestão de clientes',
  contratos:'Contratos ativos',receber:'Cobranças e recebimentos',
  pagar:'Despesas e pagamentos',fluxo:'Entradas e saídas',
  dre:'Demonstrativo de resultados',rentabilidade:'Margem por cliente',
  kpis:'Indicadores estratégicos',centros:'Classificação de despesas',
  usuarios:'Controle de acesso'
};

let currentView = 'dashboard';
let chartInstances = {};

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const view = item.dataset.view;
    currentView = view;
    document.getElementById('page-title').textContent = views[view] || view;
    document.getElementById('breadcrumb').textContent = subs[view] || '';
    loadView(view);
  });
});

async function loadView(view) {
  const content = document.getElementById('content');
  content.innerHTML = `<div class="loading"><div class="spinner"></div> Carregando...</div>`;
  if (chartInstances[view]) { chartInstances[view].forEach(c => c.destroy()); chartInstances[view] = []; }
  switch(view) {
    case 'dashboard': await renderDashboard(); break;
    case 'clientes': await renderClientes(); break;
    case 'contratos': await renderContratos(); break;
    case 'receber': await renderReceber(); break;
    case 'pagar': await renderPagar(); break;
    case 'fluxo': await renderFluxo(); break;
    case 'dre': await renderDRE(); break;
    case 'rentabilidade': await renderRentabilidade(); break;
    case 'kpis': await renderKPIs(); break;
    case 'centros': await renderCentros(); break;
    case 'usuarios': await renderUsuarios(); break;
  }
}

function fmt(v) { return 'R$ ' + Number(v||0).toLocaleString('pt-BR', {minimumFractionDigits:0, maximumFractionDigits:0}); }
function fmtK(v) { return v >= 1000000 ? 'R$ ' + (v/1000000).toFixed(1) + 'M' : v >= 1000 ? 'R$ ' + (v/1000).toFixed(0) + 'k' : fmt(v); }

async function renderDashboard() {
  const { data: clientes } = await sb.from('clientes').select('*').eq('status','ativo');
  const { data: receber } = await sb.from('contas_receber').select('*');
  const { data: pagar } = await sb.from('contas_pagar').select('*');

  const totalMRR = (clientes||[]).reduce((s,c) => s + (c.valor_mensal||0), 0);
  const totalClientes = (clientes||[]).length;
  const ticketMedio = totalClientes ? Math.round(totalMRR / totalClientes) : 0;
  const totalReceber = (receber||[]).filter(c=>c.status!=='recebido').reduce((s,c)=>s+(c.valor||0),0);
  const totalPagar = (pagar||[]).filter(c=>c.status!=='pago').reduce((s,c)=>s+(c.valor||0),0);
  const totalDespesas = (pagar||[]).reduce((s,c)=>s+(c.valor||0),0);
  const recebido = (receber||[]).filter(c=>c.status==='recebido').reduce((s,c)=>s+(c.valor||0),0);
  const saldo = recebido - totalDespesas;
  const lucro = totalMRR - totalDespesas;
  const atrasados = (receber||[]).filter(c=>{
    const v = c.data_vencimento ? new Date(c.data_vencimento+'T00:00:00') : null;
    const h = new Date(); h.setHours(0,0,0,0);
    return v && v < h && c.status !== 'recebido';
  }).length;

  document.getElementById('content').innerHTML = `
    <div class="cards-grid">
      <div class="card"><div class="card-label"><i class="ti ti-wallet" style="color:#3266ad"></i> Saldo em caixa</div><div class="card-value">${fmt(saldo)}</div><div class="card-sub neutral">Recebido − Despesas pagas</div></div>
      <div class="card"><div class="card-label"><i class="ti ti-trending-up" style="color:#0F6E56"></i> Receita do mês (MRR)</div><div class="card-value" style="color:#0F6E56">${fmt(totalMRR)}</div><div class="card-sub neutral">${totalClientes} cliente${totalClientes!==1?'s':''} ativo${totalClientes!==1?'s':''}</div></div>
      <div class="card"><div class="card-label"><i class="ti ti-trending-down" style="color:#c0392b"></i> Despesas do mês</div><div class="card-value" style="color:#c0392b">${fmt(totalDespesas)}</div><div class="card-sub neutral">Total lançado</div></div>
      <div class="card"><div class="card-label"><i class="ti ti-coins" style="color:#3266ad"></i> Lucro líquido</div><div class="card-value" style="color:${lucro>=0?'#0F6E56':'#c0392b'}">${fmt(lucro)}</div><div class="card-sub neutral">Margem ${totalMRR?Math.round(lucro/totalMRR*100):0}%</div></div>
      <div class="card"><div class="card-label"><i class="ti ti-clock" style="color:#f39c12"></i> Contas a receber</div><div class="card-value">${fmt(totalReceber)}</div><div class="card-sub" style="color:${atrasados>0?'#f39c12':'#888'}">${atrasados>0?atrasados+' em atraso':'Em dia'}</div></div>
      <div class="card"><div class="card-label"><i class="ti ti-clock" style="color:#c0392b"></i> Contas a pagar</div><div class="card-value">${fmt(totalPagar)}</div><div class="card-sub neutral">Pendentes</div></div>
      <div class="card"><div class="card-label"><i class="ti ti-chart-bar" style="color:#3266ad"></i> Faturamento anual (ARR)</div><div class="card-value">${fmtK(totalMRR*12)}</div><div class="card-sub neutral">Projeção anual</div></div>
      <div class="card"><div class="card-label"><i class="ti ti-users" style="color:#534AB7"></i> Ticket médio</div><div class="card-value">${fmt(ticketMedio)}</div><div class="card-sub neutral">${totalClientes} cliente${totalClientes!==1?'s':''} ativo${totalClientes!==1?'s':''}</div></div>
    </div>
    <div class="charts-row">
      <div class="chart-card">
        <div class="chart-title">Receitas × Despesas</div>
        <div style="position:relative;height:220px"><canvas id="chartRecDesp"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Receita por serviço</div>
        <div style="position:relative;height:220px"><canvas id="chartServico"></canvas></div>
      </div>
    </div>`;

  chartInstances['dashboard'] = [];
  chartInstances['dashboard'].push(new Chart(document.getElementById('chartRecDesp'),{
    type:'bar',
    data:{labels:['MRR','Despesas','Lucro'],datasets:[{data:[totalMRR,totalDespesas,Math.max(0,lucro)],backgroundColor:['#3266ad','#e74c3c','#1D9E75']}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>'R$'+(v/1000).toFixed(0)+'k'}}}}
  }));
  chartInstances['dashboard'].push(new Chart(document.getElementById('chartServico'),{
    type:'doughnut',
    data:{labels:['Redes Sociais','Tráfego Pago','Design/Brand','SEO','Sites','Vídeo'],datasets:[{data:[38,28,16,9,6,3],backgroundColor:['#3266ad','#e74c3c','#f39c12','#1D9E75','#534AB7','#888'],borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:11}}}}}
  }));
}

async function renderClientes() {
  const { data: clientes } = await sb.from('clientes').select('*').order('nome_empresa');
  const rows = (clientes||[]).map(c => `
    <tr>
      <td><strong>${c.nome_empresa}</strong><br><span style="font-size:11px;color:#999">${c.cnpj||''}</span></td>
      <td>${c.responsavel||'—'}</td>
      <td>${(c.servicos||[]).map(s=>`<span class="badge badge-blue">${s}</span>`).join(' ')}</td>
      <td>${c.data_inicio?new Date(c.data_inicio+'T00:00:00').toLocaleDateString('pt-BR',{month:'short',year:'numeric'}):'—'}</td>
      <td><strong>${fmt(c.valor_mensal)}</strong></td>
      <td><span class="badge ${c.status==='ativo'?'badge-green':'badge-gray'}">${c.status}</span></td>
      <td><button class="btn" onclick="editCliente('${c.id}')"><i class="ti ti-edit"></i></button></td>
    </tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="section-header">
      <div style="font-size:13px;color:#888">${(clientes||[]).length} clientes cadastrados</div>
      <button class="btn btn-primary" onclick="novoCliente()"><i class="ti ti-plus"></i> Novo cliente</button>
    </div>
    <div class="table-card">
      <table>
        <thead><tr><th>Empresa</th><th>Responsável</th><th>Serviços</th><th>Desde</th><th>Valor mensal</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows||'<tr><td colspan="7" style="text-align:center;color:#aaa;padding:32px">Nenhum cliente cadastrado</td></tr>'}</tbody>
      </table>
    </div>`;
}

function novoCliente() {
  const s=['Gestão de Redes Sociais','Tráfego Pago','Design','Branding','Site','SEO','Produção de Vídeo','Consultoria','Outros'];
  document.body.insertAdjacentHTML('beforeend',`
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Novo Cliente</span><button class="btn" onclick="closeModal()"><i class="ti ti-x"></i></button></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Nome da empresa *</label><input class="form-control" id="f_nome" placeholder="Ex: Loja Viva Moda"/></div>
          <div class="form-group"><label class="form-label">CNPJ</label><input class="form-control" id="f_cnpj" placeholder="00.000.000/0001-00"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Responsável</label><input class="form-control" id="f_resp"/></div>
          <div class="form-group"><label class="form-label">Telefone</label><input class="form-control" id="f_tel" placeholder="(00) 00000-0000"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">E-mail</label><input class="form-control" id="f_email" type="email"/></div>
          <div class="form-group"><label class="form-label">Valor mensal (R$)</label><input class="form-control" id="f_valor" type="number" placeholder="0"/></div>
        </div>
        <div class="form-group"><label class="form-label">Serviços contratados</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">${s.map(x=>`<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer"><input type="checkbox" value="${x}" class="svc-check"/> ${x}</label>`).join('')}</div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Data início</label><input class="form-control" id="f_data" type="date"/></div>
          <div class="form-group"><label class="form-label">Status</label><select class="form-control" id="f_status"><option value="ativo">Ativo</option><option value="inativo">Inativo</option><option value="prospectando">Prospectando</option></select></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <button class="btn" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="salvarCliente()"><i class="ti ti-check"></i> Salvar</button>
        </div>
      </div>
    </div>`);
}

async function salvarCliente() {
  const nome = document.getElementById('f_nome').value.trim();
  if(!nome){alert('Nome da empresa é obrigatório');return;}
  const servicos=[...document.querySelectorAll('.svc-check:checked')].map(c=>c.value);
  const{error}=await sb.from('clientes').insert({nome_empresa:nome,cnpj:document.getElementById('f_cnpj').value,responsavel:document.getElementById('f_resp').value,telefone:document.getElementById('f_tel').value,email:document.getElementById('f_email').value,valor_mensal:parseFloat(document.getElementById('f_valor').value)||0,data_inicio:document.getElementById('f_data').value||null,status:document.getElementById('f_status').value,servicos});
  if(error){alert('Erro ao salvar: '+error.message);return;}
  closeModal();loadView('clientes');
}

async function editCliente(id) {
  const{data}=await sb.from('clientes').select('*').eq('id',id).single();
  if(!data)return;
  const s=['Gestão de Redes Sociais','Tráfego Pago','Design','Branding','Site','SEO','Produção de Vídeo','Consultoria','Outros'];
  document.body.insertAdjacentHTML('beforeend',`
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Editar Cliente</span><button class="btn" onclick="closeModal()"><i class="ti ti-x"></i></button></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Nome da empresa *</label><input class="form-control" id="f_nome" value="${data.nome_empresa||''}"/></div>
          <div class="form-group"><label class="form-label">CNPJ</label><input class="form-control" id="f_cnpj" value="${data.cnpj||''}"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Responsável</label><input class="form-control" id="f_resp" value="${data.responsavel||''}"/></div>
          <div class="form-group"><label class="form-label">Valor mensal (R$)</label><input class="form-control" id="f_valor" type="number" value="${data.valor_mensal||0}"/></div>
        </div>
        <div class="form-group"><label class="form-label">Serviços</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">${s.map(x=>`<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer"><input type="checkbox" value="${x}" class="svc-check" ${(data.servicos||[]).includes(x)?'checked':''}/> ${x}</label>`).join('')}</div>
        </div>
        <div class="form-group"><label class="form-label">Status</label>
          <select class="form-control" id="f_status"><option value="ativo" ${data.status==='ativo'?'selected':''}>Ativo</option><option value="inativo" ${data.status==='inativo'?'selected':''}>Inativo</option></select>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px">
          <button class="btn btn-danger" onclick="deletarCliente('${id}')"><i class="ti ti-trash"></i> Excluir</button>
          <div style="display:flex;gap:8px"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="atualizarCliente('${id}')"><i class="ti ti-check"></i> Salvar</button></div>
        </div>
