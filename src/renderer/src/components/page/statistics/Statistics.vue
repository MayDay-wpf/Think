<template>
    <div class="statistics-header"></div>
    <div class="statistics-page">
        <div class="chart-container">
            <div class="chart-header">
                <div class="chart-title">{{ t('statistics.tokens') }}</div>
                <el-date-picker v-model="dateRange" type="daterange" :range-separator="t('statistics.to')"
                    :start-placeholder="t('statistics.startdate')" :end-placeholder="t('statistics.enddate')"
                    :shortcuts="shortcuts" @change="handleDateChange" class="date-picker" value-format="YYYY-MM-DD" />
            </div>
            <div id="tokensChart" style="width: 100%; height: 400px;"></div>
        </div>
        <div class="chart-container">
            <div class="chart-header">
                <div class="chart-title">{{ t('statistics.heatmap') }}</div>
            </div>
            <div id="heatmapChart" style="width: 100%; height: 200px;"></div>
        </div>
    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import * as echarts from 'echarts';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const chartInstance = ref(null);
const dateRange = ref([]);
const heatmapInstance = ref(null);

const createHeatmapOption = (statistics) => {
    // 处理数据
    const data = statistics.map(item => {
        return [item.date, item.totalTokens];
    });

    const maxValue = Math.max(...statistics.map(item => item.totalTokens));

    return {
        tooltip: {
            position: 'top',
            formatter: (params) => {
                return `${params.data[0]}<br/>${t('statistics.usage')}: ${params.data[1]} tokens`;
            }
        },
        visualMap: {
            min: 0,
            max: maxValue || 100,
            orient: 'horizontal',
            left: 'center',
            bottom: '0%',
            textStyle: {
                color: 'var(--el-text-color-regular)'
            },
            inRange: {
                color: ['rgba(0, 0, 0, 0)', '#9be9a8', '#40c463', '#30a14e', '#216e39']
            }
        },
        calendar: {
            top: 30,
            left: 40,
            right: 20,
            cellSize: ['auto', 20],
            range: getCalendarRange(),
            itemStyle: {
                borderWidth: 1,
                borderColor: 'var(--el-border-color-lighter)',
                color: 'transparent'
            },
            splitLine: {
                show: false
            },
            yearLabel: { show: false },
            dayLabel: {
                firstDay: 1,
                nameMap: [
                    t('calendar.sunday'),
                    t('calendar.monday'),
                    t('calendar.tuesday'),
                    t('calendar.wednesday'),
                    t('calendar.thursday'),
                    t('calendar.friday'),
                    t('calendar.saturday')
                ],
                color: '#6e7681'
            },
            monthLabel: {
                nameMap: [
                    t('calendar.january'),
                    t('calendar.february'),
                    t('calendar.march'),
                    t('calendar.april'),
                    t('calendar.may'),
                    t('calendar.june'),
                    t('calendar.july'),
                    t('calendar.august'),
                    t('calendar.september'),
                    t('calendar.october'),
                    t('calendar.november'),
                    t('calendar.december')
                ],
                color: '#6e7681'
            }
        },
        series: {
            type: 'heatmap',
            coordinateSystem: 'calendar',
            data: data,
            itemStyle: {
                borderColor: 'var(--el-bg-color)'
            }
        }
    };
};

const formatDate = (date) => {
    // 使用 YYYY-MM-DD 格式，并考虑本地时区
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getCalendarRange = () => {
    const end = new Date();
    const start = new Date();
    start.setTime(start.getTime() - 365 * 24 * 60 * 60 * 1000);
    return [formatDate(start), formatDate(end)];
};

const updateHeatmap = async (startDate, endDate) => {
    try {
        let start, end;
        if (startDate && endDate) {
            // 确保日期包含当天
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else {
            end = new Date();
            end.setHours(23, 59, 59, 999);
            const startDate = new Date();
            startDate.setTime(startDate.getTime() - 365 * 24 * 60 * 60 * 1000);
            start = startDate;
        }

        start = formatDate(start);
        end = formatDate(end);

        const statistics = await window.electron.ipcRenderer.invoke('get-daily-tokens-statistics', {
            startDate: start,
            endDate: end
        });

        if (heatmapInstance.value && statistics) {
            heatmapInstance.value.setOption(createHeatmapOption(statistics));
        }
    } catch (error) {
        console.error('Error loading daily statistics:', error);
    }
};

// 修改日期选择器的处理函数
const handleDateChange = (val) => {
    if (val) {
        updateChart(val[0], val[1]);
        updateHeatmap(val[0], val[1]);  // 添加热力图的更新
    } else {
        updateChart();
        updateHeatmap();  // 添加热力图的更新
    }
};

const updateChart = async (startDate, endDate) => {
    try {
        // 确保传入的日期字符串被转换为标准格式
        const start = startDate ? formatDate(new Date(startDate)) : undefined;
        const end = endDate ? formatDate(new Date(endDate)) : undefined;

        const statistics = await window.electron.ipcRenderer.invoke('get-model-tokens-statistics', {
            startDate: start,
            endDate: end
        });

        if (chartInstance.value) {
            chartInstance.value.setOption(createChartOption(statistics));
        }
    } catch (error) {
        console.error('Error loading statistics:', error);
    }
};

const shortcuts = [
    {
        text: t('statistics.thepastweek'),
        value: () => {
            const end = new Date();
            const start = new Date();
            start.setTime(start.getTime() - 3600 * 1000 * 24 * 7);
            return [start, end];
        },
    },
    {
        text: t('statistics.thepastmonth'),
        value: () => {
            const end = new Date();
            const start = new Date();
            start.setMonth(start.getMonth() - 1);
            return [start, end];
        },
    },
    {
        text: t('statistics.thepastquarter'),
        value: () => {
            const end = new Date();
            const start = new Date();
            start.setMonth(start.getMonth() - 3);
            return [start, end];
        },
    }
];

const createChartOption = (statistics) => {
    const data = statistics.map(item => ({
        value: item.totalTokens,
        name: item.modelName,
        itemStyle: {
            borderRadius: 5
        }
    }));

    return {
        tooltip: {
            trigger: 'item',
            formatter: (params) => {
                const stat = statistics.find(s => s.modelName === params.name);
                return `${params.name}<br/>
                    ${t('statistics.sum')}: ${params.value} tokens<br/>
                    ${t('statistics.input')}: ${stat.inputTokens} tokens<br/>
                    ${t('statistics.output')}: ${stat.outputTokens} tokens`;
            }
        },
        legend: {
            orient: 'horizontal',
            bottom: '5%',
            left: 'center',
            type: 'scroll',
            width: '80%',
            pageButtonPosition: 'end',
            pageTextStyle: {
                color: 'var(--el-text-color-primary)'
            }
        },
        series: [
            {
                name: t('statistics.tokens'),
                type: 'pie',
                radius: ['35%', '60%'],
                center: ['50%', '45%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: true,
                    formatter: '{b}: {c} tokens'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 20,
                        fontWeight: 'bold'
                    }
                },
                data: data
            }
        ]
    };
};

onMounted(async () => {
    const chartDom = document.getElementById('tokensChart');
    chartInstance.value = echarts.init(chartDom);
    await updateChart();
    const heatmapDom = document.getElementById('heatmapChart');
    heatmapInstance.value = echarts.init(heatmapDom);
    await updateHeatmap();

    window.addEventListener('resize', () => {
        chartInstance.value?.resize();
        heatmapInstance.value?.resize();
    });
});
</script>

<style scoped>
.statistics-header {
    height: 30px;
    background-color: var(--el-bg-color-overlay);
    border-bottom: 1px solid var(--el-border-color-light);
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #333;
    font-size: 18px;
    font-weight: bold;
    line-height: 30px;
    -webkit-app-region: drag;
    padding-left: 20px;
}

.statistics-page {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 31px);
    width: 100%;
    background-color: var(--el-bg-color);
    overflow-y: auto;
    overflow-x: hidden;
    box-sizing: border-box;
    padding: 10px;
}

.chart-container {
    background-color: var(--el-bg-color-overlay);
    border-radius: 8px;
    padding: 15px;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 15px;
}

.chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    gap: 10px;
    flex-wrap: wrap;
}

.date-picker {
    width: 160px;
    min-width: 160px;
}

.chart-title {
    font-size: 16px;
    font-weight: bold;
    color: var(--el-text-color-primary);
    white-space: nowrap;
}
</style>