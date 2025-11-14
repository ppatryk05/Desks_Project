
fetch("office_plan.svg")
  .then(res => res.text())
  .then(svgData => {
    const container = document.getElementById("office-container");
    container.innerHTML = svgData;
    initDesks();
  })
  .catch(err => console.error("Error loading SVG:", err));

// Load desks data from JSON and initialize states
function initDesks() {
  fetch("desks.json")
    .then(res => res.json())
    .then(desks => {
      desks.forEach(desk => {
        const el = document.getElementById(`desk_${desk.id}`);
        if (!el) return;

        if (desk.Available) {
          el.classList.add("available");
          el.addEventListener("click", () => selectDesk(desk));
        } else {
          el.classList.add("busy");
        }
        if (desk.Selected) {
          el.classList.add("selected");
          document.getElementById("selectedDesk").value = desk.id;
        }
      });
      try {
        placeDeskLabels();
      } catch (e) {
        console.error('Error while placing labels:', e);
      }
    })
    .catch(err => console.error("Error loading JSON:", err));
}

// Handle desk selection
function selectDesk(desk) {
  document.querySelectorAll(".selected").forEach(d => d.classList.remove("selected"));
  const el = document.getElementById(`desk_${desk.id}`);
  el.classList.add("selected");
  document.getElementById("selectedDesk").value = desk.id;
}

// Automatic placement of labels with desk numbers
function placeDeskLabels() {
  const svg = document.querySelector('#office-container svg');
  if (!svg) return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    svg.querySelectorAll('text.desk-label').forEach(t => t.remove());

    const groups = Array.from(svg.querySelectorAll('g[id^="desk_"]'));
    groups.forEach(g => {
      try {
        const shapes = Array.from(g.querySelectorAll('rect, path, ellipse, polygon, circle'));
        if (!shapes.length) return;

        let tableEl = shapes.find(s => (s.id || '').includes('rect23')) ||
                      shapes.find(s => {
                        const st = (s.getAttribute('style')||'').replace(/\s+/g,'');
                        return /fill:\#cccccc/i.test(st) || /fill:\s*#cccccc/i.test(st);
                      });

        if (!tableEl) {
          let best = null;
          let bestArea = 0;
          shapes.forEach(s => {
            let bbox;
            try { bbox = s.getBBox(); } catch (e) { return; }
            const area = bbox.width * bbox.height;
            if (area > bestArea) { bestArea = area; best = s; }
          });
          tableEl = best;
        }
        if (!tableEl) return;

        let bbox;
        try { bbox = tableEl.getBBox(); } catch (e) { return; }
        const localCx = bbox.x + bbox.width / 2;
        const localCy = bbox.y + bbox.height / 2;

        const pt = svg.createSVGPoint();
        pt.x = localCx; pt.y = localCy;

        const elCTM = tableEl.getCTM();
        const globalPt = pt.matrixTransform(elCTM);

        const groupCTM = g.getCTM();
        let groupInverse;
        try { groupInverse = groupCTM.inverse(); } catch (e) { groupInverse = null; }
        const finalPt = groupInverse ? globalPt.matrixTransform(groupInverse) : globalPt;

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('class', 'desk-label');
        text.setAttribute('x', finalPt.x);
        text.setAttribute('y', finalPt.y);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');

        const fontSize = Math.max(10, Math.min(30, bbox.height * 0.6));
        text.setAttribute('font-size', fontSize);

        const idMatch = (g.id || '').match(/desk_(\d+)/);
        text.textContent = idMatch ? idMatch[1] : '';
        const deskId = idMatch ? parseInt(idMatch[1], 10) : null;
        if (deskId >= 45 && deskId <= 52) {
          const groupCTM = g.getCTM();
          let groupInverse;
          try { groupInverse = groupCTM.inverse(); } catch (e) { groupInverse = null; }
          const ptGlobal = svg.createSVGPoint();
          ptGlobal.x = globalPt.x; ptGlobal.y = globalPt.y;
          const ptLocal = groupInverse ? ptGlobal.matrixTransform(groupInverse) : ptGlobal;
          text.setAttribute('transform', `rotate(270 ${ptLocal.x} ${ptLocal.y})`);
        }
        g.appendChild(text);
      } catch (e) {
        console.error('Błąd w placeDeskLabels dla', g.id, e);
      }
    });
  }));
}

// Relayout labels on window resize (debounced)
let _placeLabelsTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_placeLabelsTimer);
  _placeLabelsTimer = setTimeout(() => {
    try { placeDeskLabels(); } catch (e) { console.error(e); }
  }, 120);
});
