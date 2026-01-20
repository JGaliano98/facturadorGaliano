(function(){
  function onReady(fn){
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  onReady(function(){

    // ---------- Utilidades ----------
    function eur(n){
      n = isNaN(n) ? 0 : n;
      try {
        return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
      } catch(e){
        return (Math.round(n*100)/100).toFixed(2) + ' €';
      }
    }
    function val(id){
      var el = document.getElementById(id);
      return el ? String(el.value || '').trim() : '';
    }
    // Acepta "1.234,56" / "1,234.56" / "7,20" / "7.20"
    function toNumber(x) {
      if (x == null) return 0;
      x = String(x).trim();
      x = x.replace(',', '.');           // convierte coma en punto
      x = x.replace(/[^0-9.]/g, '');     // deja solo números y puntos
      const parts = x.split('.');
      if (parts.length > 2) {
        x = parts.shift() + '.' + parts.join(''); // un único punto decimal
      }
      const n = parseFloat(x);
      return isNaN(n) ? 0 : n;
    }
    function escapeHTML(s){
      var div = document.createElement('div');
      div.textContent = s == null ? '' : String(s);
      return div.innerHTML;
    }

    // ---------- Estado/refs ----------
    var logoDataURL = null;

    // Pre-cargar fecha e ID de factura + AUTORRELLENO negocio
    (function initDefaults(){
      var fechaEl = document.getElementById('factura_fecha');
      var numEl   = document.getElementById('factura_num');
      var today = new Date();
      var pad = function(n){ return String(n).padStart(2,'0'); };
      var y = today.getFullYear(), m = pad(today.getMonth()+1), d = pad(today.getDate());

      if (fechaEl && !fechaEl.value) fechaEl.value = y + '-' + m + '-' + d;
      if (numEl && !numEl.value) numEl.value = y + m + d + '-001';

      // Autorrelleno de datos del negocio
      var defaults = {
        negocio_nombre: 'Carnicería Charcutería Hnos. Galiano Herreros',
        negocio_nif:    '26488128-V',
        negocio_dir:    'Avenida de Andalucía 13, Local 20, 23370 Orcera (Jaén)',
        negocio_tel:    '625625404 / 652558297',
        negocio_email:  'carniceriacharcuteriagaliano@hotmail.com'
      };
      for (var id in defaults){
        var el = document.getElementById(id);
        if (el && !el.value) el.value = defaults[id];
      }
    })();

    // Manejo del logo
    var logoInput = document.getElementById('logo_input');
    if (logoInput){
      logoInput.addEventListener('change', function(e){
        var files = e && e.target && e.target.files;
        var file = files && files[0];
        if(!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          logoDataURL = reader.result;
          var prev = document.getElementById('logo_preview');
          if (prev){
            prev.innerHTML = "";
            var img = document.createElement('img');
            img.src = logoDataURL;
            prev.appendChild(img);
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // Tabla de líneas
    var tbody = document.getElementById('items_body');
    function addRow(data){
      data = data || {};
      if (!tbody){ return; }
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input placeholder="Entrecot, Chuletas, Picada..."></td>' +
        '<td><input inputmode="decimal" step="0.001" min="0"></td>' +
        '<td><input inputmode="decimal" step="0.01" min="0"></td>' +
        '<td>' +
          '<select>' +
            '<option value="0">0</option>' +
            '<option value="4">4</option>' +
            '<option value="10">10</option>' +
            '<option value="21">21</option>' +
          '</select>' +
        '</td>' +
        '<td class="right"><span class="importe">0,00 €</span></td>' +
        '<td><button type="button" class="btn danger small" title="Eliminar">✕</button></td>';

      tbody.appendChild(tr);

      // Asignar valores si vienen en data
      var inputs = tr.getElementsByTagName('input');
      if (inputs[0]) inputs[0].value = data.nombre || '';
      if (inputs[1]) inputs[1].value = (data.cant != null ? data.cant : 1);
      if (inputs[2]) inputs[2].value = (data.precio != null ? data.precio : 0);

      var sel = tr.getElementsByTagName('select')[0];
      if (sel){
        var ivaDefault = (data.iva != null ? data.iva : 21);
        sel.value = String(ivaDefault);
      }

      // Eventos de recálculo y borrar
      var fields = tr.querySelectorAll('input, select');
      for (var i=0; i<fields.length; i++){
        fields[i].addEventListener('input', recalc);
      }
      var delBtn = tr.querySelector('button');
      if (delBtn){
        delBtn.addEventListener('click', function(){
          tr.parentNode && tr.parentNode.removeChild(tr);
          recalc();
        });
      }

      recalc();
    }

    // Botón "Añadir línea"
    var addRowBtn = document.getElementById('addRowBtn');
    if (addRowBtn){
      addRowBtn.addEventListener('click', function(){ addRow(); });
    }

    // Asegura al menos 1 fila
    if (tbody && !tbody.rows.length){ addRow(); }

    function recalc(){
      if (!tbody) return;
      var subtotal = 0, ivaTotal = 0;
      var rows = tbody.rows;
      for (var r=0; r<rows.length; r++){
        var tr = rows[r];
        var cant = 0, precio = 0, iva = 0;

        var cell1 = tr.cells[1] && tr.cells[1].querySelector('input');
        var cell2 = tr.cells[2] && tr.cells[2].querySelector('input');
        var cell3 = tr.cells[3] && tr.cells[3].querySelector('select');

        if (cell1) cant   = toNumber(cell1.value);
        if (cell2) precio = toNumber(cell2.value);
        if (cell3) iva    = toNumber(cell3.value);

        var base = Math.round(cant * precio * 100) / 100;
        var ivaImp = Math.round(base * (iva/100) * 100) / 100;
        var totalLinea = Math.round((base + ivaImp) * 100) / 100;

        subtotal += base;
        ivaTotal += ivaImp;

        var impEl = tr.querySelector('.importe');
        if (impEl) impEl.textContent = eur(totalLinea);
      }

      var subEl = document.getElementById('subtotal');
      var ivaEl = document.getElementById('iva_total');
      var totEl = document.getElementById('total');
      if (subEl) subEl.textContent = eur(Math.round(subtotal*100)/100);
      if (ivaEl) ivaEl.textContent = eur(Math.round(ivaTotal*100)/100);
      if (totEl) totEl.textContent = eur(Math.round((subtotal+ivaTotal)*100)/100);
    }

    // ====== Generar PDF (FACTURA / PROFORMA) ======
    function generatePDF(tipo){
      if (typeof html2pdf === 'undefined'){
        alert('No se pudo cargar html2pdf desde el CDN. Revisa tu conexión o usa un servidor local.');
        return;
      }

      // Título y nota según tipo
      var titleEl = document.querySelector('#pdf_area .pdf-title');
      if (titleEl) titleEl.textContent = (tipo === 'proforma') ? 'PROFORMA' : 'FACTURA';

      var footerNote = document.querySelector('#pdf_area .pdf-footer > div:first-child');
      if (footerNote){
        footerNote.textContent = (tipo === 'proforma')
          ? 'Documento PROFORMA sin validez fiscal.'
          : 'Gracias por su compra.';
      }

      // Marca de agua PROFORMA
      var existing = document.getElementById('proforma-watermark');
      if (existing) existing.parentNode.removeChild(existing);
      if (tipo === 'proforma'){
        var wm = document.createElement('div');
        wm.id = 'proforma-watermark';
        wm.textContent = 'PROFORMA';
        wm.style.position = 'absolute';
        wm.style.inset = '0';
        wm.style.display = 'flex';
        wm.style.justifyContent = 'center';
        wm.style.alignItems = 'center';
        wm.style.fontSize = '120px';
        wm.style.fontWeight = '800';
        wm.style.color = '#C0392B';
        wm.style.opacity = '0.08';
        wm.style.transform = 'rotate(-30deg)';
        wm.style.pointerEvents = 'none';
        var host = document.querySelector('#pdf_area .pdf-doc');
        if (host) host.appendChild(wm);
      }

      // Llevar datos a plantilla
      var pnumEl = document.getElementById('p_num');
      var pfechaEl = document.getElementById('p_fecha');
      if (pnumEl) pnumEl.textContent = val('factura_num') || '—';

      if (pfechaEl){
        var d = val('factura_fecha');
        if (d){
          var parts = d.split('-');
          var Y = parseInt(parts[0],10), M = parseInt(parts[1],10), D = parseInt(parts[2],10);
          var f = new Date(Y, (M||1)-1, D||1);
          pfechaEl.textContent = f.toLocaleDateString('es-ES');
        } else {
          pfechaEl.textContent = '—';
        }
      }

      // Logo
      var pLogo = document.getElementById('p_logo');
      if (pLogo){
        pLogo.innerHTML = '';
        if (logoDataURL){
          var img = document.createElement('img');
          img.src = logoDataURL;
          img.style.maxWidth = '100%';
          img.style.maxHeight = '100%';
          pLogo.appendChild(img);
        } else {
          pLogo.innerHTML = '<span style="color:#999; font-size:12px">Logo</span>';
        }
      }

      // Bloques de texto
      var negocio = [
        val('negocio_nombre'),
        val('negocio_nif') ? ('NIF/CIF: ' + val('negocio_nif')) : '',
        val('negocio_dir'),
        val('negocio_tel') ? ('Tel: ' + val('negocio_tel')) : '',
        val('negocio_email') ? ('Email: ' + val('negocio_email')) : ''
      ].filter(Boolean).join('<br>');
      var cliente = [
        val('cliente_nombre'),
        val('cliente_nif') ? ('NIF/DNI: ' + val('cliente_nif')) : '',
        val('cliente_dir'),
        val('cliente_tel') ? ('Tel: ' + val('cliente_tel')) : '',
        val('cliente_email') ? ('Email: ' + val('cliente_email')) : ''
      ].filter(Boolean).join('<br>');

      var pNeg = document.getElementById('p_negocio');
      var pCli = document.getElementById('p_cliente');
      if (pNeg) pNeg.innerHTML = negocio || '—';
      if (pCli) pCli.innerHTML = cliente || '—';

      var pNotas = document.getElementById('p_notas');
      if (pNotas) pNotas.textContent = val('factura_notas') || '';

      // Items
      var pItems = document.getElementById('p_items');
      if (pItems) pItems.innerHTML = '';
      var subtotal = 0, ivaTotal = 0;

      if (tbody){
        var rows = tbody.rows;
        for (var r=0; r<rows.length; r++){
          var tr = rows[r];
          var nombre = '-';
          var cant = 0, precio = 0, iva = 0;

          var cell0 = tr.cells[0] && tr.cells[0].querySelector('input');
          var cell1 = tr.cells[1] && tr.cells[1].querySelector('input');
          var cell2 = tr.cells[2] && tr.cells[2].querySelector('input');
          var cell3 = tr.cells[3] && tr.cells[3].querySelector('select');

          if (cell0) nombre = cell0.value || '-';
          if (cell1) cant   = toNumber(cell1.value);
          if (cell2) precio = toNumber(cell2.value);
          if (cell3) iva    = toNumber(cell3.value);

          var base   = Math.round(cant * precio * 100) / 100;
          var ivaImp = Math.round(base * (iva/100) * 100) / 100;
          var totalLinea = Math.round((base + ivaImp) * 100) / 100;

          subtotal += base; ivaTotal += ivaImp;

          if (pItems){
            var trp = document.createElement('tr');
            trp.innerHTML =
              '<td style="padding:8px; border-bottom:1px solid #f0f0f0">' + escapeHTML(nombre) + '</td>' +
              '<td style="padding:8px; text-align:right; border-bottom:1px solid #f0f0f0">' + cant.toLocaleString('es-ES') + '</td>' +
              '<td style="padding:8px; text-align:right; border-bottom:1px solid #f0f0f0">' + eur(precio) + '</td>' +
              '<td style="padding:8px; text-align:right; border-bottom:1px solid #f0f0f0">' + iva + '%</td>' +
              '<td style="padding:8px; text-align:right; border-bottom:1px solid #f0f0f0">' + eur(totalLinea) + '</td>';
            pItems.appendChild(trp);
          }
        }
      }

      var pSub = document.getElementById('p_subtotal');
      var pIvt = document.getElementById('p_ivat');
      var pTot = document.getElementById('p_total');
      if (pSub) pSub.textContent = eur(Math.round(subtotal*100)/100);
      if (pIvt) pIvt.textContent = eur(Math.round(ivaTotal*100)/100);
      if (pTot) pTot.textContent = eur(Math.round((subtotal+ivaTotal)*100)/100);

      // Mostrar temporalmente la zona PDF para capturarla
      var pdfArea = document.getElementById('pdf_area');
      if (!pdfArea){
        alert('No se encontró el contenedor de PDF (pdf_area).');
        return;
      }
      var prevDisplay = pdfArea.style.display;
      pdfArea.style.display = 'block';

      var pref = (tipo === 'proforma') ? 'Proforma_' : 'Factura_';
      var opt = {
        margin: [10,10,10,10],
        filename: (pref + (val('factura_num') || 'sin-numero').replace(/[^\w\-]+/g,'_') + '.pdf'),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      html2pdf().set(opt).from(pdfArea).save().then(function(){
        pdfArea.style.display = prevDisplay || 'none';
      }).catch(function(err){
        console.error(err);
        alert('No se pudo generar el PDF. Abre la consola (F12) para más detalles.');
        pdfArea.style.display = prevDisplay || 'none';
      });
    }

    // Enlazar botones de generación
    var btnFactura = document.getElementById('genFacturaBtn');
    if (btnFactura){ btnFactura.addEventListener('click', function(){ generatePDF('factura'); }); }
    var btnProforma = document.getElementById('genProformaBtn');
    if (btnProforma){ btnProforma.addEventListener('click', function(){ generatePDF('proforma'); }); }

  }); // onReady

})(); // IIFE
