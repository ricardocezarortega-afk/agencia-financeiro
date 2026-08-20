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
  content.innerHTML = '<div class="loading"><div class="spinner"></div> Carregando...</div>';
  if (chartInstances[view]) { chartInstances[view].forEach(c => c.destroy()); chartInstances[view] = []; }
  try {
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
  } catch(e) {
    content.innerHTML = '<div class="loading" style="color:#c0392b">Erro ao carregar: ' + e.message + '</div>';
  }
}

function fmt(v) { return 'R$ ' + Number(v||0).toLocaleString('pt-BR', {minimumFractionDigits:0, maximumFractionDigits:0}); }
function fmtK(v) { return v >= 1000000 ? 'R$ ' + (v/1000000).toFixed(1) + 'M' : v >= 1000 ? 'R$ ' + (v/1000).toFixed(0) + 'k' : fmt(v); }
function closeModal() { const m = document.getElementById('modalOverlay'); if(m) m.remove(); }

async function renderDashboard() {
  const [{data:clientes},{data:receber},{data:pagar}] = await Promise.all([
    sb.from('clientes').select('*').eq('status','ativo'),
    sb.from('contas_receber').select('*'),
    sb.from('contas_pagar').select('*')
  ]);
  const totalMRR = (clientes||[]).reduce((s,c)=>s+(c.valor_mensal||0),0);
  const totalClientes = (clientes||[]).length;
  const ticketMedio = totalClientes ? Math.round(totalMRR/totalClientes) : 0;
  const totalReceber = (receber||[]).filter(c=>c.status!=='recebido').reduce((s,c)=>s+(c.valor||0),0);
  const totalPagar = (pagar||[]).filter(c=>c.status!=='pago').reduce((s,c)=>s+(c.valor||0),0);
  const totalDespesas = (pagar||[]).reduce((s,c)=>s+(c.valor||0),0);
  const recebido = (receber||[]).filter(c=>c.status==='recebido').reduce((s,c)=>s+(c.valor||0),0);
  const pago = (pagar||[]).filter(c=>c.status==='pago').reduce((s,c)=>s+(c.valor||0),0);
  const saldo = recebido - pago;
  const lucro = totalMRR - totalDespesas;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const atrasados = (receber||[]).filter(c=>{
    const v = c.data_vencimento ? new Date(c.data_vencimento+'T00:00:00') : null;
    return v && v < hoje && c.status !== 'recebido';
  }).length;

  document.getElementById('content').innerHTML = `
    <div class="cards-grid">
      <div class="card"><div class="card-label"><i class="ti ti-wallet" style="color:#3266ad"></i> Saldo em caixa</div><div class="card-value" style="color:${saldo>=0?'inherit':'#c0392b'}">${fmt(saldo)}</div><div class="card-sub neutral">Recebido − Despesas pagas</div></div>
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
        <div class="chart-title">Resumo financeiro do mês</div>
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
    data:{
      labels:['MRR','Despesas','Lucro'],
      datasets:[{data:[totalMRR,totalDespesas,Math.max(0,lucro)],backgroundColor:['#3266ad','#e74c3c','#1D9E75'],borderRadius:6}]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>'R$'+(v/1000).toFixed(0)+'k'}}}}
  }));
  chartInstances['dashboard'].push(new Chart(document.getElementById('chartServico'),{
    type:'doughnut',
    data:{
      labels:['Redes Sociais','Tráfego Pago','Design/Brand','SEO','Sites','Vídeo'],
      datasets:[{data:[38,28,16,9,6,3],backgroundColor:['#3266ad','#e74c3c','#f39c12','#1D9E75','#534AB7','#888'],borderWidth:2,borderColor:'#fff'}]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:11}}}}}
  }));
}

async function renderClientes() {
  const {data:clientes} = await sb.from('clientes').select('*').order('nome_empresa');
  const rows = (clientes||[]).map(c=>`
    <tr>
      <td><strong>${c.nome_empresa}</strong><br><span style="font-size:11px;color:#999">${c.cnpj||''}</span></td>
      <td>${c.responsavel||'—'}</td>
      <td>${(c.servicos||[]).map(s=>'<span class="badge badge-blue">'+s+'</span>').join(' ')}</td>
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
  const s = ['Gestão de Redes Sociais','Tráfego Pago','Design','Branding','Site','SEO','Produção de Vídeo','Consultoria','Outros'];
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
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">${s.map(x=>'<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer"><input type="checkbox" value="'+x+'" class="svc-check"/> '+x+'</label>').join('')}</div>
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
  const servicos = [...document.querySelectorAll('.svc-check:checked')].map(c=>c.value);
  const {error} = await sb.from('clientes').insert({
    nome_empresa:nome, cnpj:document.getElementById('f_cnpj').value,
    responsavel:document.getElementById('f_resp').value, telefone:document.getElementById('f_tel').value,
    email:document.getElementById('f_email').value, valor_mensal:parseFloat(document.getElementById('f_valor').value)||0,
    data_inicio:document.getElementById('f_data').value||null, status:document.getElementById('f_status').value, servicos
  });
  if(error){alert('Erro ao salvar: '+error.message);return;}
  closeModal(); loadView('clientes');
}

async function editCliente(id) {
  const {data} = await sb.from('clientes').select('*').eq('id',id).single();
  if(!data) return;
  const s = ['Gestão de Redes Sociais','Tráfego Pago','Design','Branding','Site','SEO','Produção de Vídeo','Consultoria','Outros'];
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
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">${s.map(x=>'<label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer"><input type="checkbox" value="'+x+'" class="svc-check" '+((data.servicos||[]).includes(x)?'checked':'')+'/> '+x+'</label>').join('')}</div>
        </div>
        <div class="form-group"><label class="form-label">Status</label>
          <select class="form-control" id="f_status">
            <option value="ativo" ${data.status==='ativo'?'selected':''}>Ativo</option>
            <option value="inativo" ${data.status==='inativo'?'selected':''}>Inativo</option>
            <option value="prospectando" ${data.status==='prospectando'?'selected':''}>Prospectando</option>
          </select>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px">
          <button class="btn btn-danger" onclick="deletarCliente('${id}')"><i class="ti ti-trash"></i> Excluir</button>
          <div style="display:flex;gap:8px">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="atualizarCliente('${id}')"><i class="ti ti-check"></i> Salvar</button>
          </div>
        </div>
      </div>
    </div>`);
}

async function atualizarCliente(id) {
  const servicos = [...document.querySelectorAll('.svc-check:checked')].map(c=>c.value);
  await sb.from('clientes').update({
    nome_empresa:document.getElementById('f_nome').value, cnpj:document.getElementById('f_cnpj').value,
    responsavel:document.getElementById('f_resp').value, valor_mensal:parseFloat(document.getElementById('f_valor').value)||0,
    status:document.getElementById('f_status').value, servicos
  }).eq('id',id);
  closeModal(); loadView('clientes');
}

async function deletarCliente(id) {
  if(!confirm('Excluir este cliente?')) return;
  await sb.from('clientes').delete().eq('id',id);
  closeModal(); loadView('clientes');
}

async function renderReceber() {
  const [{data:clientes},{data:contas}] = await Promise.all([
    sb.from('clientes').select('id,nome_empresa'),
    sb.from('contas_receber').select('*').order('data_vencimento')
  ]);
  const mapa = Object.fromEntries((clientes||[]).map(c=>[c.id,c.nome_empresa]));
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const rows = (contas||[]).map(c=>{
    const v = c.data_vencimento ? new Date(c.data_vencimento+'T00:00:00') : null;
    const at = v && v < hoje && c.status !== 'recebido';
    const sf = at ? 'atrasado' : c.status;
    const bc = sf==='recebido'?'badge-green':sf==='atrasado'?'badge-red':'badge-amber';
    return '<tr><td>'+( mapa[c.cliente_id]||'—')+'</td><td>'+(c.servico||c.descricao||'—')+'</td><td>'+(v?v.toLocaleDateString('pt-BR'):'—')+'</td><td><strong style="color:#0F6E56">'+fmt(c.valor)+'</strong></td><td><span class="badge '+bc+'">'+sf+'</span></td><td>'+(sf!=='recebido'?'<button class="btn" onclick="baixarReceber(\''+c.id+'\')"><i class="ti ti-check"></i> Baixar</button>':'')+' <button class="btn" onclick="deletarReceber(\''+c.id+'\')"><i class="ti ti-trash"></i></button></td></tr>';
  }).join('');
  const total = (contas||[]).reduce((s,c)=>s+(c.valor||0),0);
  const recebido = (contas||[]).filter(c=>c.status==='recebido').reduce((s,c)=>s+(c.valor||0),0);
  document.getElementById('content').innerHTML = `
    <div class="section-header">
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div class="card" style="padding:10px 14px"><div class="card-label" style="margin-bottom:2px">Total previsto</div><div style="font-size:16px;font-weight:600;color:#0F6E56">${fmt(total)}</div></div>
        <div class="card" style="padding:10px 14px"><div class="card-label" style="margin-bottom:2px">Recebido</div><div style="font-size:16px;font-weight:600;color:#3266ad">${fmt(recebido)}</div></div>
        <div class="card" style="padding:10px 14px"><div class="card-label" style="margin-bottom:2px">A receber</div><div style="font-size:16px;font-weight:600;color:#f39c12">${fmt(total-recebido)}</div></div>
      </div>
      <button class="btn btn-primary" onclick="novaCobranca()"><i class="ti ti-plus"></i> Nova cobrança</button>
    </div>
    <div class="table-card"><table><thead><tr><th>Cliente</th><th>Serviço</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>${rows||'<tr><td colspan="6" style="text-align:center;color:#aaa;padding:32px">Nenhuma cobrança cadastrada</td></tr>'}</tbody></table></div>`;
}

function novaCobranca() {
  sb.from('clientes').select('id,nome_empresa').eq('status','ativo').then(({data:cl})=>{
    const opts = (cl||[]).map(c=>'<option value="'+c.id+'">'+c.nome_empresa+'</option>').join('');
    document.body.insertAdjacentHTML('beforeend',`
      <div class="modal-overlay" id="modalOverlay">
        <div class="modal">
          <div class="modal-header"><span class="modal-title">Nova Cobrança</span><button class="btn" onclick="closeModal()"><i class="ti ti-x"></i></button></div>
          <div class="form-group"><label class="form-label">Cliente *</label><select class="form-control" id="f_cli"><option value="">Selecione...</option>${opts}</select></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Serviço / Descrição</label><input class="form-control" id="f_svc" placeholder="Ex: Gestão de Redes — Agosto"/></div>
            <div class="form-group"><label class="form-label">Valor (R$) *</label><input class="form-control" id="f_val" type="number" placeholder="0"/></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Data emissão</label><input class="form-control" id="f_emis" type="date"/></div>
            <div class="form-group"><label class="form-label">Data vencimento *</label><input class="form-control" id="f_venc" type="date"/></div>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
            <button class="btn" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="salvarCobranca()"><i class="ti ti-check"></i> Salvar</button>
          </div>
        </div>
      </div>`);
  });
}

async function salvarCobranca() {
  const cli = document.getElementById('f_cli').value;
  const val = document.getElementById('f_val').value;
  const venc = document.getElementById('f_venc').value;
  if(!cli||!val||!venc){alert('Preencha os campos obrigatórios');return;}
  await sb.from('contas_receber').insert({
    cliente_id:cli, servico:document.getElementById('f_svc').value,
    valor:parseFloat(val), data_emissao:document.getElementById('f_emis').value||null,
    data_vencimento:venc, status:'em_aberto'
  });
  closeModal(); loadView('receber');
}

async function baixarReceber(id) {
  await sb.from('contas_receber').update({status:'recebido',data_pagamento:new Date().toISOString().split('T')[0]}).eq('id',id);
  loadView('receber');
}

async function deletarReceber(id) {
  if(!confirm('Excluir esta cobrança?')) return;
  await sb.from('contas_receber').delete().eq('id',id);
  loadView('receber');
}

async function renderPagar() {
  const {data:contas} = await sb.from('contas_pagar').select('*').order('data_vencimento');
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const rows = (contas||[]).map(c=>{
    const v = c.data_vencimento ? new Date(c.data_vencimento+'T00:00:00') : null;
    const at = v && v < hoje && c.status !== 'pago';
    const sf = at ? 'atrasado' : c.status;
    const bc = sf==='pago'?'badge-green':sf==='atrasado'?'badge-red':'badge-amber';
    return '<tr><td>'+(c.descricao||'—')+'</td><td><span class="badge badge-blue">'+(c.categoria||'—')+'</span></td><td>'+(v?v.toLocaleDateString('pt-BR'):'—')+'</td><td>'+(c.forma_pagamento||'—')+'</td><td><strong style="color:#c0392b">'+fmt(c.valor)+'</strong></td><td><span class="badge '+bc+'">'+sf+'</span></td><td>'+(sf!=='pago'?'<button class="btn" onclick="baixarPagar(\''+c.id+'\')"><i class="ti ti-check"></i> Pagar</button>':'')+' <button class="btn" onclick="deletarPagar(\''+c.id+'\')"><i class="ti ti-trash"></i></button></td></tr>';
  }).join('');
  const total = (contas||[]).reduce((s,c)=>s+(c.valor||0),0);
  const pago = (contas||[]).filter(c=>c.status==='pago').reduce((s,c)=>s+(c.valor||0),0);
  document.getElementById('content').innerHTML = `
    <div class="section-header">
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <div class="card" style="padding:10px 14px"><div class="card-label" style="margin-bottom:2px">Total mês</div><div style="font-size:16px;font-weight:600">${fmt(total)}</div></div>
        <div class="card" style="padding:10px 14px"><div class="card-label" style="margin-bottom:2px">Pago</div><div style="font-size:16px;font-weight:600;color:#0F6E56">${fmt(pago)}</div></div>
        <div class="card" style="padding:10px 14px"><div class="card-label" style="margin-bottom:2px">Pendente</div><div style="font-size:16px;font-weight:600;color:#f39c12">${fmt(total-pago)}</div></div>
      </div>
      <button class="btn btn-primary" onclick="novaDespesa()"><i class="ti ti-plus"></i> Nova despesa</button>
    </div>
    <div class="table-card"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Vencimento</th><th>Forma pgto</th><th>Valor</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows||'<tr><td colspan="7" style="text-align:center;color:#aaa;padding:32px">Nenhuma despesa cadastrada</td></tr>'}</tbody></table></div>`;
}

function novaDespesa() {
  const cats = ['Folha de pagamento','Impostos','Ferramentas','Tráfego pago','Internet','Energia','Aluguel','Marketing','Terceiros','Freelancers'];
  const formas = ['PIX','Transferência','Boleto','Cartão','DARF'];
  const centros = ['Equipe','Ferramentas e Software','Infraestrutura','Prospecção','Marketing Interno','Freelancers / Terceiros','Impostos e Taxas'];
  document.body.insertAdjacentHTML('beforeend',`
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Nova Despesa</span><button class="btn" onclick="closeModal()"><i class="ti ti-x"></i></button></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Descrição *</label><input class="form-control" id="f_desc" placeholder="Ex: Adobe Creative Cloud"/></div>
          <div class="form-group"><label class="form-label">Valor (R$) *</label><input class="form-control" id="f_val" type="number" placeholder="0"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Categoria</label><select class="form-control" id="f_cat"><option value="">Selecione...</option>${cats.map(c=>'<option>'+c+'</option>').join('')}</select></div>
          <div class="form-group"><label class="form-label">Centro de custo</label><select class="form-control" id="f_centro"><option value="">Selecione...</option>${centros.map(c=>'<option>'+c+'</option>').join('')}</select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Vencimento *</label><input class="form-control" id="f_venc" type="date"/></div>
          <div class="form-group"><label class="form-label">Forma de pagamento</label><select class="form-control" id="f_forma"><option value="">Selecione...</option>${formas.map(f=>'<option>'+f+'</option>').join('')}</select></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <button class="btn" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="salvarDespesa()"><i class="ti ti-check"></i> Salvar</button>
        </div>
      </div>
    </div>`);
}

async function salvarDespesa() {
  const desc = document.getElementById('f_desc').value;
  const val = document.getElementById('f_val').value;
  const venc = document.getElementById('f_venc').value;
  if(!desc||!val||!venc){alert('Preencha os campos obrigatórios');return;}
  await sb.from('contas_pagar').insert({
    descricao:desc, valor:parseFloat(val), categoria:document.getElementById('f_cat').value,
    centro_custo:document.getElementById('f_centro').value, data_vencimento:venc,
    forma_pagamento:document.getElementById('f_forma').value, status:'pendente'
  });
  closeModal(); loadView('pagar');
}

async function baixarPagar(id) {
  await sb.from('contas_pagar').update({status:'pago',data_pagamento:new Date().toISOString().split('T')[0]}).eq('id',id);
  loadView('pagar');
}

async function deletarPagar(id) {
  if(!confirm('Excluir esta despesa?')) return;
  await sb.from('contas_pagar').delete().eq('id',id);
  loadView('pagar');
}

async function renderContratos() {
  const [{data:clientes},{data:contratos}] = await Promise.all([
    sb.from('clientes').select('id,nome_empresa'),
    sb.from('contratos').select('*').order('data_vencimento')
  ]);
  const mapa = Object.fromEntries((clientes||[]).map(c=>[c.id,c.nome_empresa]));
  const rows = (contratos||[]).map(c=>`
    <tr>
      <td>${mapa[c.cliente_id]||'—'}</td><td>${c.tipo||'recorrente'}</td>
      <td>${c.data_inicio?new Date(c.data_inicio+'T00:00:00').toLocaleDateString('pt-BR'):'—'}</td>
      <td>${c.data_vencimento?new Date(c.data_vencimento+'T00:00:00').toLocaleDateString('pt-BR'):'—'}</td>
      <td><strong>${fmt(c.valor_mensal)}</strong></td>
      <td>${c.reajuste_anual?'<span class="badge badge-blue">'+(c.indice_reajuste||'IPCA')+'</span>':'—'}</td>
      <td><span class="badge ${c.status==='ativo'?'badge-green':c.status==='encerrado'?'badge-gray':'badge-amber'}">${c.status}</span></td>
      <td><button class="btn" onclick="deletarContrato('${c.id}')"><i class="ti ti-trash"></i></button></td>
    </tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="section-header">
      <div style="font-size:13px;color:#888">${(contratos||[]).length} contratos</div>
      <button class="btn btn-primary" onclick="novoContrato(${JSON.stringify(clientes||[])})"><i class="ti ti-plus"></i> Novo contrato</button>
    </div>
    <div class="table-card"><table><thead><tr><th>Cliente</th><th>Tipo</th><th>Início</th><th>Vencimento</th><th>Valor mensal</th><th>Reajuste</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows||'<tr><td colspan="8" style="text-align:center;color:#aaa;padding:32px">Nenhum contrato cadastrado</td></tr>'}</tbody></table></div>`;
}

function novoContrato(clientes) {
  const opts = clientes.map(c=>'<option value="'+c.id+'">'+c.nome_empresa+'</option>').join('');
  document.body.insertAdjacentHTML('beforeend',`
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Novo Contrato</span><button class="btn" onclick="closeModal()"><i class="ti ti-x"></i></button></div>
        <div class="form-group"><label class="form-label">Cliente *</label><select class="form-control" id="f_cli"><option value="">Selecione...</option>${opts}</select></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Tipo</label><select class="form-control" id="f_tipo"><option value="recorrente">Recorrente</option><option value="avulso">Avulso</option></select></div>
          <div class="form-group"><label class="form-label">Valor mensal (R$)</label><input class="form-control" id="f_val" type="number" placeholder="0"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Data início</label><input class="form-control" id="f_inicio" type="date"/></div>
          <div class="form-group"><label class="form-label">Data vencimento</label><input class="form-control" id="f_venc" type="date"/></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Reajuste anual?</label><select class="form-control" id="f_reaj"><option value="true">Sim (IPCA)</option><option value="false">Não</option></select></div>
          <div class="form-group"><label class="form-label">Status</label><select class="form-control" id="f_status"><option value="ativo">Ativo</option><option value="em_renovacao">Em renovação</option><option value="encerrado">Encerrado</option></select></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <button class="btn" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="salvarContrato()"><i class="ti ti-check"></i> Salvar</button>
        </div>
      </div>
    </div>`);
}

async function salvarContrato() {
  const cli = document.getElementById('f_cli').value;
  if(!cli){alert('Selecione um cliente');return;}
  await sb.from('contratos').insert({
    cliente_id:cli, tipo:document.getElementById('f_tipo').value,
    valor_mensal:parseFloat(document.getElementById('f_val').value)||0,
    data_inicio:document.getElementById('f_inicio').value||null,
    data_vencimento:document.getElementById('f_venc').value||null,
    reajuste_anual:document.getElementById('f_reaj').value==='true',
    status:document.getElementById('f_status').value
  });
  closeModal(); loadView('contratos');
}

async function deletarContrato(id) {
  if(!confirm('Excluir este contrato?')) return;
  await sb.from('contratos').delete().eq('id',id);
  loadView('contratos');
}

async function renderFluxo() {
  const [{data:receber},{data:pagar}] = await Promise.all([
    sb.from('contas_receber').select('*').order('data_vencimento'),
    sb.from('contas_pagar').select('*').order('data_vencimento')
  ]);
  const entradas = (receber||[]).reduce((s,c)=>s+(c.valor||0),0);
  const saidas = (pagar||[]).reduce((s,c)=>s+(c.valor||0),0);
  const recebido = (receber||[]).filter(c=>c.status==='recebido').reduce((s,c)=>s+(c.valor||0),0);
  const pago = (pagar||[]).filter(c=>c.status==='pago').reduce((s,c)=>s+(c.valor||0),0);
  const saldo = recebido - pago;
  const rowsR = (receber||[]).map(c=>'<tr><td>'+(c.servico||c.descricao||'Recebimento')+'</td><td><span class="badge badge-green">Entrada</span></td><td>'+(c.data_vencimento?new Date(c.data_vencimento+'T00:00:00').toLocaleDateString('pt-BR'):'—')+'</td><td style="color:#0F6E56">+'+fmt(c.valor)+'</td><td><span class="badge '+(c.status==='recebido'?'badge-green':'badge-amber')+'">'+c.status+'</span></td></tr>').join('');
  const rowsP = (pagar||[]).map(c=>'<tr><td>'+(c.descricao||'Despesa')+'</td><td><span class="badge badge-red">Saída</span></td><td>'+(c.data_vencimento?new Date(c.data_vencimento+'T00:00:00').toLocaleDateString('pt-BR'):'—')+'</td><td style="color:#c0392b">-'+fmt(c.valor)+'</td><td><span class="badge '+(c.status==='pago'?'badge-green':'badge-amber')+'">'+c.status+'</span></td></tr>').join('');
  document.getElementById('content').innerHTML = `
    <div class="cards-grid" style="grid-template-columns:repeat(3,1fr)">
      <div class="card"><div class="card-label">Entradas previstas</div><div class="card-value" style="color:#0F6E56">${fmt(entradas)}</div></div>
      <div class="card"><div class="card-label">Saídas previstas</div><div class="card-value" style="color:#c0392b">${fmt(saidas)}</div></div>
      <div class="card"><div class="card-label">Saldo realizado</div><div class="card-value" style="color:${saldo>=0?'inherit':'#c0392b'}">${fmt(saldo)}</div></div>
    </div>
    <div class="table-card">
      <div class="table-header"><span style="font-size:13px;font-weight:600">Lançamentos</span></div>
      <table><thead><tr><th>Descrição</th><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Status</th></tr></thead>
      <tbody>${rowsR}${rowsP}${!rowsR&&!rowsP?'<tr><td colspan="5" style="text-align:center;color:#aaa;padding:32px">Nenhum lançamento</td></tr>':''}</tbody></table>
    </div>`;
}

async function renderDRE() {
  const [{data:clientes},{data:pagar}] = await Promise.all([
    sb.from('clientes').select('valor_mensal'),
    sb.from('contas_pagar').select('valor,categoria')
  ]);
  const receita = (clientes||[]).reduce((s,c)=>s+(c.valor_mensal||0),0);
  const imposto = Math.round(receita*0.069);
  const recLiq = receita - imposto;
  const soma = (cat) => (pagar||[]).filter(c=>c.categoria===cat).reduce((s,c)=>s+(c.valor||0),0);
  const folha = soma('Folha de pagamento');
  const ferramentas = soma('Ferramentas');
  const freelancers = soma('Freelancers');
  const aluguel = soma('Aluguel');
  const internet = soma('Internet');
  const marketing = soma('Marketing');
  const impostos = soma('Impostos');
  const outros = (pagar||[]).filter(c=>!['Folha de pagamento','Ferramentas','Freelancers','Aluguel','Internet','Marketing','Impostos'].includes(c.categoria)).reduce((s,c)=>s+(c.valor||0),0);
  const lucroBruto = recLiq - folha - ferramentas - freelancers;
  const lucroOp = lucroBruto - aluguel - internet - marketing - outros;
  const lucroLiq = lucroOp - impostos;
  const pct = v => receita ? Math.round(Math.abs(v)/receita*100)+'%' : '0%';
  const row = (label,valor,cls,indent) => `<tr class="${cls||''}"><td ${indent?'class="dre-indent"':''}>${label}</td><td style="text-align:right;font-weight:${cls?'600':'400'};color:${valor<0?'#c0392b':'inherit'}">${valor<0?'− '+fmt(Math.abs(valor)):fmt(valor)}</td><td style="text-align:right;color:#888">${pct(valor)}</td></tr>`;
  document.getElementById('content').innerHTML = `
    <div class="section-header"><span style="font-size:13px;color:#888">Mês atual — baseado nos dados lançados</span></div>
    <div class="table-card">
      <div class="table-header"><span style="font-size:13px;font-weight:600">Demonstrativo de Resultados</span></div>
      <table><thead><tr><th>Descrição</th><th style="text-align:right">Valor</th><th style="text-align:right">% Receita</th></tr></thead>
      <tbody>
        ${row('Receita Bruta (MRR)',receita,'dre-row-total',false)}
        ${row('(−) Impostos (Simples 6,9%)',-imposto,'',true)}
        ${row('Receita Líquida',recLiq,'dre-row-total',false)}
        ${folha?row('(−) Folha de pagamento',-folha,'',true):''}
        ${ferramentas?row('(−) Ferramentas',-ferramentas,'',true):''}
        ${freelancers?row('(−) Freelancers / terceiros',-freelancers,'',true):''}
        ${row('Lucro Bruto',lucroBruto,'dre-row-total',false)}
        ${aluguel?row('(−) Aluguel',-aluguel,'',true):''}
        ${internet?row('(−) Internet / energia',-internet,'',true):''}
        ${marketing?row('(−) Marketing',-marketing,'',true):''}
        ${outros?row('(−) Outras despesas',-outros,'',true):''}
        ${row('Lucro Operacional',lucroOp,'dre-row-total',false)}
        ${impostos?row('(−) Impostos lançados',-impostos,'',true):''}
        ${row('Lucro Líquido',lucroLiq,'dre-row-result',false)}
      </tbody></table>
    </div>`;
}

async function renderRentabilidade() {
  const [{data:clientes},{data:horas}] = await Promise.all([
    sb.from('clientes').select('*').eq('status','ativo'),
    sb.from('horas_cliente').select('*')
  ]);
  const mes = new Date().getMonth()+1;
  const ano = new Date().getFullYear();
  const horasMapa = Object.fromEntries((horas||[]).filter(h=>h.mes===mes&&h.ano===ano).map(h=>[h.cliente_id,h]));
  const dados = (clientes||[]).map(c=>{
    const h = horasMapa[c.id]||{horas_consumidas:0,custo_hora:150};
    const custo = (h.horas_consumidas||0)*(h.custo_hora||150);
    const margem = c.valor_mensal ? ((c.valor_mensal-custo)/c.valor_mensal*100) : 0;
    const cl = margem>50?{label:'Muito lucrativo',badge:'badge-green',dot:'dot-green',color:'#1D9E75'}
      :margem>30?{label:'Lucrativo',badge:'badge-green',dot:'dot-green',color:'#1D9E75'}
      :margem>10?{label:'Atenção',badge:'badge-amber',dot:'dot-amber',color:'#f39c12'}
      :{label:'Prejuízo',badge:'badge-red',dot:'dot-red',color:'#e74c3c'};
    return {...c,horas:h.horas_consumidas||0,custo,margem,cl};
  }).sort((a,b)=>b.margem-a.margem);
  const rows = dados.map((c,i)=>`
    <tr>
      <td style="font-weight:600;color:#888">${i+1}</td>
      <td><strong>${c.nome_empresa}</strong></td>
      <td>${fmt(c.valor_mensal)}</td>
      <td>${c.horas}h</td>
      <td>${fmt(c.custo)}</td>
      <td><div class="semaforo-row"><div class="dot ${c.cl.dot}"></div><div class="progress-bar"><div class="progress-fill" style="width:${Math.max(0,Math.min(100,c.margem))}%;background:${c.cl.color}"></div></div><span style="font-weight:600;color:${c.cl.color};min-width:52px">${c.margem.toFixed(1)}%</span></div></td>
      <td><span class="badge ${c.cl.badge}">${c.cl.label}</span></td>
      <td><button class="btn" onclick="editarHoras('${c.id}','${c.nome_empresa}',${c.horas})"><i class="ti ti-clock"></i> Horas</button></td>
    </tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="section-header"><span style="font-size:13px;color:#888">Ranking de rentabilidade — ${new Date().toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</span></div>
    <div class="table-card"><table><thead><tr><th>#</th><th>Cliente</th><th>Receita mensal</th><th>Horas</th><th>Custo equipe</th><th>Margem</th><th>Classificação</th><th></th></tr></thead>
    <tbody>${rows||'<tr><td colspan="8" style="text-align:center;color:#aaa;padding:32px">Nenhum cliente ativo. Cadastre clientes primeiro.</td></tr>'}</tbody></table></div>`;
}

function editarHoras(clienteId,nome,horasAtuais) {
  document.body.insertAdjacentHTML('beforeend',`
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Horas — ${nome}</span><button class="btn" onclick="closeModal()"><i class="ti ti-x"></i></button></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Horas consumidas no mês</label><input class="form-control" id="f_horas" type="number" value="${horasAtuais}"/></div>
          <div class="form-group"><label class="form-label">Custo por hora (R$)</label><input class="form-control" id="f_custo" type="number" value="150"/></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <button class="btn" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="salvarHoras('${clienteId}')"><i class="ti ti-check"></i> Salvar</button>
        </div>
      </div>
    </div>`);
}

async function salvarHoras(clienteId) {
  const mes = new Date().getMonth()+1;
  const ano = new Date().getFullYear();
  const horas = parseFloat(document.getElementById('f_horas').value)||0;
  const custo = parseFloat(document.getElementById('f_custo').value)||150;
  const {data:exist} = await sb.from('horas_cliente').select('id').eq('cliente_id',clienteId).eq('mes',mes).eq('ano',ano).maybeSingle();
  if(exist) {
    await sb.from('horas_cliente').update({horas_consumidas:horas,custo_hora:custo}).eq('id',exist.id);
  } else {
    await sb.from('horas_cliente').insert({cliente_id:clienteId,mes,ano,horas_consumidas:horas,custo_hora:custo});
  }
  closeModal(); loadView('rentabilidade');
}

async function renderKPIs() {
  const [{data:clientes},{data:pagar}] = await Promise.all([
    sb.from('clientes').select('valor_mensal').eq('status','ativo'),
    sb.from('contas_pagar').select('valor')
  ]);
  const mrr = (clientes||[]).reduce((s,c)=>s+(c.valor_mensal||0),0);
  const despesas = (pagar||[]).reduce((s,c)=>s+(c.valor||0),0);
  const qtd = (clientes||[]).length;
  const ticket = qtd ? Math.round(mrr/qtd) : 0;
  const margem = mrr ? Math.round((mrr-despesas)/mrr*100) : 0;
  document.getElementById('content').innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">MRR</div><div class="kpi-value">${fmt(mrr)}</div><div class="kpi-desc">Receita recorrente mensal</div></div>
      <div class="kpi-card" style="border-left-color:#0F6E56"><div class="kpi-label">ARR</div><div class="kpi-value">${fmtK(mrr*12)}</div><div class="kpi-desc">Projeção anual</div></div>
      <div class="kpi-card" style="border-left-color:#f39c12"><div class="kpi-label">Ticket médio</div><div class="kpi-value">${fmt(ticket)}</div><div class="kpi-desc">${qtd} cliente${qtd!==1?'s':''} ativo${qtd!==1?'s':''}</div></div>
      <div class="kpi-card" style="border-left-color:#534AB7"><div class="kpi-label">Margem líquida</div><div class="kpi-value">${margem}%</div><div class="kpi-desc">MRR − Despesas / MRR</div></div>
      <div class="kpi-card" style="border-left-color:#e74c3c"><div class="kpi-label">Churn rate</div><div class="kpi-value">0</div><div class="kpi-desc">Cancelamentos no mês</div></div>
      <div class="kpi-card" style="border-left-color:#0F6E56"><div class="kpi-label">LTV médio</div><div class="kpi-value">${fmtK(ticket*36)}</div><div class="kpi-desc">36 meses × ticket médio</div></div>
      <div class="kpi-card" style="border-left-color:#993C1D"><div class="kpi-label">CAC</div><div class="kpi-value">—</div><div class="kpi-desc">Lance despesas de prospecção</div></div>
      <div class="kpi-card" style="border-left-color:#3266ad"><div class="kpi-label">Despesas totais</div><div class="kpi-value">${fmt(despesas)}</div><div class="kpi-desc">Total lançado no mês</div></div>
    </div>`;
}

async function renderCentros() {
  const {data:centros} = await sb.from('centros_custo').select('*').order('nome');
  const rows = (centros||[]).map(c=>`
    <tr>
      <td>${c.nome}</td>
      <td><span class="badge badge-blue">${c.tipo||'—'}</span></td>
      <td>${fmt(c.orcamento_mensal)}</td>
      <td><button class="btn" onclick="deletarCentro('${c.id}')"><i class="ti ti-trash"></i></button></td>
    </tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="section-header">
      <div style="font-size:13px;color:#888">${(centros||[]).length} centros cadastrados</div>
      <button class="btn btn-primary" onclick="novoCentro()"><i class="ti ti-plus"></i> Novo centro</button>
    </div>
    <div class="table-card"><table><thead><tr><th>Centro de custo</th><th>Tipo</th><th>Orçamento mensal</th><th></th></tr></thead>
    <tbody>${rows||'<tr><td colspan="4" style="text-align:center;color:#aaa;padding:32px">Nenhum centro cadastrado</td></tr>'}</tbody></table></div>`;
}

function novoCentro() {
  document.body.insertAdjacentHTML('beforeend',`
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Novo Centro de Custo</span><button class="btn" onclick="closeModal()"><i class="ti ti-x"></i></button></div>
        <div class="form-group"><label class="form-label">Nome *</label><input class="form-control" id="f_nome" placeholder="Ex: Equipe de Design"/></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Tipo</label><select class="form-control" id="f_tipo"><option value="operacional">Operacional</option><option value="comercial">Comercial</option><option value="producao">Produção</option><option value="fiscal">Fiscal</option></select></div>
          <div class="form-group"><label class="form-label">Orçamento mensal (R$)</label><input class="form-control" id="f_orc" type="number" placeholder="0"/></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <button class="btn" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="salvarCentro()"><i class="ti ti-check"></i> Salvar</button>
        </div>
      </div>
    </div>`);
}

async function salvarCentro() {
  const nome = document.getElementById('f_nome').value;
  if(!nome){alert('Nome obrigatório');return;}
  await sb.from('centros_custo').insert({nome,tipo:document.getElementById('f_tipo').value,orcamento_mensal:parseFloat(document.getElementById('f_orc').value)||0});
  closeModal(); loadView('centros');
}

async function deletarCentro(id) {
  if(!confirm('Excluir este centro?')) return;
  await sb.from('centros_custo').delete().eq('id',id);
  loadView('centros');
}

async function renderUsuarios() {
  const {data:usuarios} = await sb.from('usuarios').select('*').order('nome');
  const rows = (usuarios||[]).map(u=>`
    <tr>
      <td><strong>${u.nome}</strong></td>
      <td>${u.email}</td>
      <td><span class="badge ${u.perfil==='administrador'?'badge-blue':u.perfil==='financeiro'?'badge-green':u.perfil==='comercial'?'badge-amber':'badge-gray'}">${u.perfil}</span></td>
      <td><span class="badge ${u.ativo?'badge-green':'badge-gray'}">${u.ativo?'Ativo':'Inativo'}</span></td>
      <td><button class="btn" onclick="deletarUsuario('${u.id}')"><i class="ti ti-trash"></i></button></td>
    </tr>`).join('');
  document.getElementById('content').innerHTML = `
    <div class="section-header">
      <div style="font-size:13px;color:#888">${(usuarios||[]).length} usuários</div>
      <button class="btn btn-primary" onclick="novoUsuario()"><i class="ti ti-user-plus"></i> Convidar usuário</button>
    </div>
    <div class="table-card"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th></th></tr></thead>
    <tbody>${rows||'<tr><td colspan="5" style="text-align:center;color:#aaa;padding:32px">Nenhum usuário cadastrado</td></tr>'}</tbody></table></div>`;
}

function novoUsuario() {
  document.body.insertAdjacentHTML('beforeend',`
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal">
        <div class="modal-header"><span class="modal-title">Novo Usuário</span><button class="btn" onclick="closeModal()"><i class="ti ti-x"></i></button></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Nome *</label><input class="form-control" id="f_nome" placeholder="Nome completo"/></div>
          <div class="form-group"><label class="form-label">E-mail *</label><input class="form-control" id="f_email" type="email"/></div>
        </div>
        <div class="form-group"><label class="form-label">Perfil de acesso</label>
          <select class="form-control" id="f_perfil">
            <option value="administrador">Administrador — acesso total</option>
            <option value="financeiro">Financeiro — receitas e despesas</option>
            <option value="comercial">Comercial — clientes e contratos</option>
            <option value="operacional">Operacional — consulta apenas</option>
          </select>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
          <button class="btn" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-primary" onclick="salvarUsuario()"><i class="ti ti-check"></i> Salvar</button>
        </div>
      </div>
    </div>`);
}

async function salvarUsuario() {
  const nome = document.getElementById('f_nome').value;
  const email = document.getElementById('f_email').value;
  if(!nome||!email){alert('Nome e e-mail são obrigatórios');return;}
  await sb.from('usuarios').insert({nome,email,perfil:document.getElementById('f_perfil').value,ativo:true});
  closeModal(); loadView('usuarios');
}

async function deletarUsuario(id) {
  if(!confirm('Excluir este usuário?')) return;
  await sb.from('usuarios').delete().eq('id',id);
  loadView('usuarios');
}

loadView('dashboard');
