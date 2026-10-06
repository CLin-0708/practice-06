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
};

// 窗口自适应
window.addEventListener('resize', () => {
  if (barChart) barChart.resize();
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
