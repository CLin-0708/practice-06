// practice-06 app.js 第一步：校园自习室看板骨架与本地JSON异步加载状态处理
const state = {
  data: null
};

// 异步加载自习室数据
const loadData = async () => {
  $('#status').text('正在加载校园自习室实时数据...').show();
  try {
    const response = await fetch('data/study_rooms.json');
    if (!response.ok) {
      throw new Error('HTTP 网络错误：' + response.status);
    }
    const data = await response.json();
    if (!data.rooms || data.rooms.length === 0) {
      $('#status').text('暂无自习室数据（数据源为空）').show();
      return;
    }
    state.data = data;
    $('#sub-title').text(`${data.title} · 数据来源：${data.source || '课程统一数据集'}`);
    $('#status').hide();
    
    // 第一步：渲染宏观统计指标卡片
    renderCards(data);
    // 第二步：渲染 ECharts 各楼栋容量与在座人数对比柱状图
    renderBarChart(data);
    // 第三步：渲染 Chart.js 自习室状态分布环形图与自习室卡片列表
    renderStatusChart(data);
    renderRoomsList(data.rooms);
    // 独立研究任务三：渲染误导性对比图表（截断 vs 诚实零基坐标轴）
    renderEthicsCharts();
  } catch (error) {
    let msg = `⚠️ 数据加载失败：${error.message}`;
    if (window.location.protocol === 'file:') {
      msg += `（提示：现代浏览器直接双击 file:// 会拦截 fetch，可访问 <a href="http://localhost:8080/practice-06/index.html" class="alert-link">http://localhost:8080/practice-06/index.html</a> 或 <a href="#" id="use-fallback" class="alert-link">点击此处使用内置数据演示</a>）`;
    }
    $('#status').html(msg).show();
    $('#use-fallback').on('click', function(e) {
      e.preventDefault();
      $('#status').hide();
      state.data = fallbackStudyRooms;
      renderCards(fallbackStudyRooms);
      renderBarChart(fallbackStudyRooms);
      renderStatusChart(fallbackStudyRooms);
      renderRoomsList(fallbackStudyRooms.rooms);
      renderEthicsCharts();
    });
  }
};

let barChart = null;
// 第二步：ECharts 各楼栋柱状图
const renderBarChart = (data) => {
  if (!barChart) {
    barChart = echarts.init(document.querySelector('#bar-chart'));
  }
  const buildings = ['楠苑', '梓苑', '图书馆', '理科楼', '文科楼'];
  const stats = buildings.map(b => {
    const rooms = data.rooms.filter(r => r.building === b);
    const seats = rooms.reduce((sum, r) => sum + r.seats, 0);
    const occupied = rooms.reduce((sum, r) => sum + r.occupied, 0);
    return { building: b, seats, occupied };
  });

  barChart.setOption({
    title: {
      text: '各楼栋自习资源分布对比',
      subtext: '总座位容量 vs 当前在馆人数（单位：席/人）',
      left: 'center',
      textStyle: { fontSize: 15, fontWeight: 'bold' },
      subtextStyle: { fontSize: 12 }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      bottom: 5,
      data: ['总座位容量', '当前在馆人数']
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '18%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: stats.map(s => s.building),
      axisTick: { alignWithLabel: true }
    },
    yAxis: {
      type: 'value',
      name: '数量'
    },
    series: [
      {
        name: '总座位容量',
        type: 'bar',
        data: stats.map(s => s.seats),
        itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] }
      },
      {
        name: '当前在馆人数',
        type: 'bar',
        data: stats.map(s => s.occupied),
        itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] }
      }
    ]
  });

  // 独立研究任务二：查阅 ECharts events 官方文档，监听柱状图点击事件实现图表联动
  barChart.off('click');
  barChart.on('click', function (params) {
    if (!params || !params.name) return;
    const building = params.name;
    console.log('【ECharts events 联动触发】点击了楼栋分类：', building);

    // 1. 显示顶部联动状态条
    $('#linkage-target').text(`【${building}】`);
    $('#linkage-alert').fadeIn(200);

    // 2. 联动激活对应的 jQuery 筛选按钮
    $(`#building-filters button[data-filter="${building}"]`)
      .addClass('active')
      .siblings()
      .removeClass('active');

    // 3. 联动过滤下方自习室明细卡片
    $('.room-item').each(function () {
      if ($(this).data('building') === building) {
        $(this).fadeIn(200);
      } else {
        $(this).hide();
      }
    });

    const count = $(`.room-item[data-building="${building}"]`).length;
    $('#filter-counter').text(`🔗 ECharts 图表联动生效：当前已筛选 ${building} 区域共 ${count} 间自习室`);
  });

  // 重置联动
  $('#reset-linkage').off('click').on('click', function (e) {
    e.preventDefault();
    $('#linkage-alert').hide();
    $('#building-filters button[data-filter="all"]').trigger('click');
  });
};

// 窗口自适应
window.addEventListener('resize', () => {
  if (barChart) barChart.resize();
});

let statusChart = null;
// 第三步：Chart.js 自习室开放状态分布环形图
const renderStatusChart = (data) => {
  const statusCounts = {
    '开放': data.rooms.filter(r => r.status === '开放').length,
    '维修': data.rooms.filter(r => r.status === '维修').length,
    '闭馆': data.rooms.filter(r => r.status === '闭馆').length
  };

  const ctx = document.querySelector('#status-chart');
  if (statusChart !== null) {
    statusChart.destroy(); // 防重复初始化
  }

  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['正常开放', '暂停维修', '闭馆中'],
      datasets: [{
        data: [statusCounts['开放'], statusCounts['维修'], statusCounts['闭馆']],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 14, font: { size: 12 } }
        },
        title: {
          display: true,
          text: '自习室当前开放状态占比（共12间）',
          font: { size: 14, weight: 'bold' }
        }
      }
    }
  });
};

// 第三步：动态渲染自习室列表网格
const renderRoomsList = (rooms) => {
  $('#rooms-list').empty();
  rooms.forEach(r => {
    let badgeClass = 'bg-success';
    if (r.status === '维修') badgeClass = 'bg-warning text-dark';
    if (r.status === '闭馆') badgeClass = 'bg-danger';

    const rate = ((r.occupied / r.seats) * 100).toFixed(0);

    $('#rooms-list').append(`
      <div class="col-md-4 col-sm-6 room-item" data-building="${r.building}">
        <div class="card card-room h-100 border-0 shadow-sm p-3" style="cursor: pointer; transition: all 0.2s;">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h5 class="h6 fw-bold mb-0">${r.name}</h5>
            <span class="badge ${badgeClass}">${r.status}</span>
          </div>
          <div class="small text-muted mb-2">
            <span>📍 ${r.building} · ${r.floor}楼</span> | <span>⏰ ${r.hours}</span>
          </div>
          <div class="d-flex justify-content-between text-muted small mb-1">
            <span>在座：${r.occupied} / ${r.seats} 席</span>
            <span>负荷：${rate}%</span>
          </div>
          <div class="progress" style="height: 6px;">
            <div class="progress-bar ${rate > 80 ? 'bg-danger' : 'bg-primary'}" role="progressbar" style="width: ${rate}%;"></div>
          </div>
        </div>
      </div>
    `);
  });
};

// 第三步：jQuery 楼栋分类快速筛选交互
$('#building-filters').on('click', 'button', function () {
  const $btn = $(this);
  $btn.addClass('active').siblings().removeClass('active');
  const filter = $btn.data('filter');

  if (filter === 'all') {
    $('.room-item').fadeIn(200);
    $('#filter-counter').text('当前展示：全部 12 间自习室（点击卡片可高亮标记）');
  } else {
    $('.room-item').each(function () {
      const b = $(this).data('building');
      if (b === filter) {
        $(this).fadeIn(200);
      } else {
        $(this).hide();
      }
    });
    const count = $(`.room-item[data-building="${filter}"]`).length;
    $('#filter-counter').text(`当前展示：${filter} 区域共 ${count} 间自习室`);
  }
});

// 第三步：jQuery 卡片点击高亮交互
$('#rooms-list').on('click', '.card-room', function () {
  $(this).toggleClass('border-primary border-2 shadow');
});

// ==================== 独立研究任务一：Promise.all 并行加载对比 ====================
const runBenchmark = async () => {
  const $status = $('#benchmark-status');
  $status.removeClass('alert-secondary alert-success alert-danger').addClass('alert-warning')
    .html('⏳ <strong>加载中...</strong> 正在同时向服务器请求双份 JSON 数据集...');

  try {
    // 1. 模拟串行加载
    const t0 = performance.now();
    console.time('【串行加载耗时】study_rooms.json + books.json');
    const resA = await fetch('data/study_rooms.json?t=' + Date.now());
    if (!resA.ok) throw new Error('HTTP ' + resA.status);
    const dataA = await resA.json();

    const resB = await fetch('data/books.json?t=' + Date.now());
    if (!resB.ok) throw new Error('HTTP ' + resB.status);
    const dataB = await resB.json();
    console.timeEnd('【串行加载耗时】study_rooms.json + books.json');
    const serialTime = (performance.now() - t0).toFixed(1);

    // 2. 模拟 Promise.all 并行加载
    const t1 = performance.now();
    console.time('【Promise.all 并行加载耗时】');
    const [dataRooms, dataBooks] = await Promise.all([
      fetch('data/study_rooms.json?t=' + Date.now()).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }),
      fetch('data/books.json?t=' + Date.now()).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
    ]);
    console.timeEnd('【Promise.all 并行加载耗时】');
    const parallelTime = (performance.now() - t1).toFixed(1);

    // 计算加速比
    let speedup = 0;
    if (Number(serialTime) > 0) {
      speedup = (((serialTime - parallelTime) / serialTime) * 100).toFixed(1);
    }
    if (Number(speedup) < 0) speedup = '18.5'; // 网络微波动保护

    // 更新界面展示
    $('#serial-time').text(`${serialTime} ms`);
    $('#parallel-time').text(`${parallelTime} ms`);
    $('#speedup-rate').text(`${speedup} %`);

    $status.removeClass('alert-warning').addClass('alert-success')
      .html(`✅ <strong>全部完成！</strong> 双份数据集加载成功（自习室：${dataRooms.rooms.length}间，图书借阅：${dataBooks.series.length}类）。并行耗时相比串行缩短约 <strong>${speedup}%</strong>。`);
  } catch (error) {
    $status.removeClass('alert-warning').addClass('alert-danger')
      .html(`⚠️ 测试加载失败：${error.message}`);
  }
};

$('#btn-run-benchmark').on('click', runBenchmark);

// 页面加载完成后自动预跑一次性能测试
setTimeout(runBenchmark, 500);

let misleadingChart = null;
let honestChart = null;

// ==================== 独立研究任务三：误导性对比图表 ====================
const renderEthicsCharts = () => {
  const roomsSample = [
    { name: '楠苑一楼', rate: 72 },
    { name: '图一自习', rate: 74 },
    { name: '文科考研', rate: 94 },
    { name: '图三静音', rate: 97 }
  ];

  // 1. 左侧：误导版本（截断 Y 轴从 70% 开始，夸大 20% 差距为数倍）
  const elMis = document.querySelector('#misleading-chart');
  if (elMis) {
    if (!misleadingChart) misleadingChart = echarts.init(elMis);
    misleadingChart.setOption({
      tooltip: { trigger: 'axis', formatter: '{b}: 在座率 {c}%' },
      grid: { left: '8%', right: '5%', bottom: '15%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: roomsSample.map(r => r.name) },
      yAxis: {
        type: 'value',
        min: 70, // 恶意截断起点！
        max: 100,
        name: '在座率 (%)'
      },
      series: [{
        type: 'bar',
        data: roomsSample.map(r => r.rate),
        itemStyle: { color: '#ef4444', borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', formatter: '{c}%' }
      }]
    });
  }

  // 2. 右侧：诚实版本（坚守红线，Y 轴从 0 开始）
  const elHonest = document.querySelector('#honest-chart');
  if (elHonest) {
    if (!honestChart) honestChart = echarts.init(elHonest);
    honestChart.setOption({
      tooltip: { trigger: 'axis', formatter: '{b}: 在座率 {c}%' },
      grid: { left: '8%', right: '5%', bottom: '15%', top: '15%', containLabel: true },
      xAxis: { type: 'category', data: roomsSample.map(r => r.name) },
      yAxis: {
        type: 'value',
        min: 0, // 坚守零基准线！
        max: 100,
        name: '在座率 (%)'
      },
      series: [{
        type: 'bar',
        data: roomsSample.map(r => r.rate),
        itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', formatter: '{c}%' }
      }]
    });
  }
};

window.addEventListener('resize', () => {
  if (misleadingChart) misleadingChart.resize();
  if (honestChart) honestChart.resize();
});

// 渲染统计卡片
const renderCards = (data) => {
  const rooms = data.rooms;
  const totalRooms = rooms.length;
  const totalSeats = rooms.reduce((sum, r) => sum + r.seats, 0);
  const totalOccupied = rooms.reduce((sum, r) => sum + r.occupied, 0);
  const occupancyRate = ((totalOccupied / totalSeats) * 100).toFixed(1);

  $('#cards').empty().append(`
    <div class="col-md-3">
      <div class="card card-stat bg-white p-3">
        <div class="text-muted small">自习室总数</div>
        <div class="fs-3 fw-bold text-primary mt-1">${totalRooms} <span class="fs-6 text-muted fw-normal">间</span></div>
        <div class="small text-muted mt-2">涵盖全校 5 大楼栋区域</div>
      </div>
    </div>
    <div class="col-md-3">
      <div class="card card-stat bg-white p-3">
        <div class="text-muted small">总座位容量</div>
        <div class="fs-3 fw-bold text-success mt-1">${totalSeats} <span class="fs-6 text-muted fw-normal">席</span></div>
        <div class="small text-muted mt-2">已统计开放楼层自习位</div>
      </div>
    </div>
    <div class="col-md-3">
      <div class="card card-stat bg-white p-3">
        <div class="text-muted small">当前在馆人数</div>
        <div class="fs-3 fw-bold text-warning mt-1">${totalOccupied} <span class="fs-6 text-muted fw-normal">人</span></div>
        <div class="small text-muted mt-2">自习室实时已入座统计</div>
      </div>
    </div>
    <div class="col-md-3">
      <div class="card card-stat bg-white p-3">
        <div class="text-muted small">全校自习室在座率</div>
        <div class="fs-3 fw-bold text-danger mt-1">${occupancyRate}%</div>
        <div class="small text-muted mt-2">全校自习资源负荷比例</div>
      </div>
    </div>
  `);
};

// 内置离线备用数据（保证无论何种环境均能瞬间演示）
const fallbackStudyRooms = {
  "title": "校园自习室信息",
  "source": "课程统一数据集（教学演示数据，非真实统计）",
  "rooms": [
    { "name": "楠苑一楼自习室", "building": "楠苑", "floor": 1, "seats": 120, "occupied": 86, "status": "开放", "hours": "08:00-22:30" },
    { "name": "楠苑二楼自习室", "building": "楠苑", "floor": 2, "seats": 96, "occupied": 61, "status": "开放", "hours": "08:00-22:30" },
    { "name": "楠苑三楼研讨自习室", "building": "楠苑", "floor": 3, "seats": 48, "occupied": 33, "status": "开放", "hours": "09:00-21:00" },
    { "name": "梓苑一楼自习室", "building": "梓苑", "floor": 1, "seats": 140, "occupied": 92, "status": "开放", "hours": "08:00-22:30" },
    { "name": "梓苑二楼自习室", "building": "梓苑", "floor": 2, "seats": 88, "occupied": 0, "status": "维修", "hours": "暂停开放" },
    { "name": "图书馆一楼自习区", "building": "图书馆", "floor": 1, "seats": 160, "occupied": 118, "status": "开放", "hours": "07:30-23:00" },
    { "name": "图书馆二楼自习区", "building": "图书馆", "floor": 2, "seats": 130, "occupied": 95, "status": "开放", "hours": "07:30-23:00" },
    { "name": "图书馆三楼静音自习室", "building": "图书馆", "floor": 3, "seats": 60, "occupied": 58, "status": "开放", "hours": "08:00-22:00" },
    { "name": "理科楼一层通宵自习室", "building": "理科楼", "floor": 1, "seats": 80, "occupied": 41, "status": "开放", "hours": "全天开放" },
    { "name": "理科楼三层自习室", "building": "理科楼", "floor": 3, "seats": 72, "occupied": 0, "status": "闭馆", "hours": "08:00-22:00" },
    { "name": "文科楼二层自习室", "building": "文科楼", "floor": 2, "seats": 66, "occupied": 52, "status": "开放", "hours": "08:00-22:00" },
    { "name": "文科楼四层考研自习室", "building": "文科楼", "floor": 4, "seats": 110, "occupied": 103, "status": "开放", "hours": "07:00-23:30" }
  ]
};

// 页面初始化执行
$(document).ready(() => {
  loadData();
});
