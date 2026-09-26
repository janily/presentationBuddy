## 一、引言

在工业控制领域，嵌入式触摸屏设备正变得越来越普遍。本文基于真实的项目开发经验，分享 Qt 5.15 在 ARM Linux 平台嵌入式触摸屏场景下的 UI 界面开发实践。

### 1.1 项目目录结构

一个典型的 Qt Widgets 项目采用以下目录结构：

```
project/
├── project.pro          # qmake 项目文件
├── main.cpp             # 程序入口
├── include/             # 头文件目录
│   ├── ui/              # 页面类头文件
│   ├── widgets/         # 自定义组件头文件
│   ├── models/          # 数据模型头文件
│   ├── service/         # 业务服务头文件
│   └── util/            # 工具类头文件
├── src/                 # 源文件目录
│   ├── ui/              # 页面类实现
│   ├── widgets/         # 自定义组件实现
│   ├── models/          # 数据模型实现
│   ├── service/         # 业务服务实现
│   └── util/            # 工具类实现
└── resources/           # 资源文件目录
    ├── resources.qrc    # 资源描述文件
    ├── images/          # 图片资源
    ├── qss/             # 样式表文件
    └── translations/    # 翻译文件
```

### 1.2 各模块职责

| 目录 | 职责 | 示例 |
|------|------|------|
| `ui/` | 页面级组件，对应应用的各个功能页面 | MainWindow、SettingsPage、LoginPage |
| `widgets/` | 可复用的 UI 组件，跨页面共享 | TopToolbar、BottomNavBar、FormField |
| `models/` | 数据结构定义和数据管理 | DeviceData、UserInfo、ConfigModel |
| `service/` | 业务逻辑和外部通信 | DataService、NetworkClient |
| `util/` | 通用工具类 | TranslationManager、Logger |
| `resources/` | 静态资源文件 | 图片、样式表、翻译文件 |

### 1.3 qmake 项目文件

`.pro` 文件是 Qt 项目的核心配置文件：

```qmake
QT += core gui widgets charts

TARGET = ems-app
TEMPLATE = app

# 头文件路径
INCLUDEPATH += include

# 源文件
SOURCES += \
    main.cpp \
    src/ui/mainwindow.cpp \
    src/widgets/toptoolbar.cpp

# 头文件
HEADERS += \
    include/ui/mainwindow.h \
    include/widgets/toptoolbar.h

# 资源文件
RESOURCES += resources/resources.qrc

# 翻译文件
TRANSLATIONS += \
    resources/translations/app_en_US.ts \
    resources/translations/app_zh_CN.ts
```

### 1.4 代码组织原则

**头文件与源文件分离**

```cpp
// include/ui/settingspage.h - 头文件
class SettingsPage : public QWidget {
    Q_OBJECT
public:
    explicit SettingsPage(QWidget* parent = nullptr);
private:
    void setupUI();
    QLineEdit* m_nameEdit;
};

// src/ui/settingspage.cpp - 源文件
#include "ui/settingspage.h"

SettingsPage::SettingsPage(QWidget* parent) : QWidget(parent) {
    setupUI();
}
```

**页面类的典型结构**

```cpp
class MyPage : public QWidget {
    Q_OBJECT
public:
    explicit MyPage(QWidget* parent = nullptr);

public slots:
    void retranslateUi();  // 国际化刷新

private:
    void setupUI();        // 初始化界面
    void connectSignals(); // 连接信号槽

private:
    // UI 组件成员
    QLabel* m_titleLabel;
    QPushButton* m_submitButton;
};
```

本文将从以下几个方面展开：

- **QSS 样式系统**：基础语法、选择器、实践技巧
- **布局系统**：布局管理器、QScrollArea 机制
- **表格组件**：QTableWidget 的样式与配置
- **自定义组件**：轮播图、分页器的实现
- **图表组件**：Qt Charts 折线图、双Y轴、实时更新
- **虚拟键盘**：触摸屏输入的完整解决方案
- **国际化**：多语言支持与动态切换
- **屏幕保护与事件处理**：跨平台事件机制

---

## 二、QSS 样式系统

### 2.1 什么是 QSS

Qt Style Sheets（QSS）是 Qt 提供的样式表系统，语法类似 CSS，用于定制控件的外观。通过 QSS，可以在不修改 C++ 代码的情况下改变应用程序的视觉风格。

**基本语法**

```css
选择器 {
    属性: 值;
    属性: 值;
}
```

**示例**

```css
QPushButton {
    background-color: #3498db;
    color: white;
    border-radius: 5px;
    padding: 10px 20px;
}
```

### 2.2 选择器类型

QSS 支持多种选择器，优先级从低到高：

| 选择器类型 | 语法 | 示例 | 说明 |
|-----------|------|------|------|
| 类型选择器 | `ClassName` | `QPushButton` | 匹配所有该类型控件 |
| 类选择器 | `.ClassName` | `.QPushButton` | 匹配该类及其子类 |
| ID 选择器 | `#objectName` | `#submitBtn` | 匹配特定 objectName |
| 后代选择器 | `Parent Child` | `QWidget QPushButton` | 匹配父控件内的子控件 |
| 子选择器 | `Parent > Child` | `QFrame > QPushButton` | 匹配直接子控件 |

**使用 ID 选择器**

```cpp
// C++ 中设置 objectName
m_submitButton->setObjectName("submitBtn");
```

```css
/* QSS 中使用 ID 选择器 */
#submitBtn {
    background-color: #27ae60;
}
```

### 2.3 伪状态

QSS 支持伪状态来定义控件在不同状态下的样式：

```css
QPushButton {
    background-color: #3498db;
}

QPushButton:hover {
    background-color: #2980b9;
}

QPushButton:pressed {
    background-color: #1a5276;
}

QPushButton:disabled {
    background-color: #bdc3c7;
    color: #7f8c8d;
}
```

常用伪状态：
- `:hover` - 鼠标悬停
- `:pressed` - 按下状态
- `:disabled` - 禁用状态
- `:checked` - 选中状态（复选框、单选按钮）
- `:focus` - 获得焦点

### 2.4 加载样式表

**方式一：全局加载**

```cpp
// main.cpp 或 MainWindow 构造函数中
QFile file(":/qss/style.qss");
if (file.open(QFile::ReadOnly)) {
    QString styleSheet = file.readAll();
    qApp->setStyleSheet(styleSheet);
}
```

**方式二：内联样式**

```cpp
// 为单个控件设置样式
m_button->setStyleSheet("background-color: #3498db; color: white;");
```

### 2.5 实践中的注意事项

**注意点 1：QTableWidget::item 不支持 font 属性**

这是 Qt 的一个限制，表格单元格的字体必须在代码中设置：

```cpp
// QSS 中 font-size 不生效
// #table QTableWidget::item { font-size: 18px; }  ❌

// 必须在代码中设置
QFont cellFont;
cellFont.setPixelSize(18);
item->setFont(cellFont);  // ✅
```

**注意点 2：避免 C++ 和 QSS 同时设置同一属性**

当两者冲突时，可能导致意外的渲染结果：

```cpp
// 不推荐：同时在两处设置字体
item->setFont(font);  // C++ 设置
// 同时 QSS 也设置了 font-size
```

**注意点 3：内联样式优先级最高**

如果需要覆盖全局样式，使用 `setStyleSheet()`：

```cpp
// 这会覆盖全局 QSS 中的样式
m_specialButton->setStyleSheet(R"(
    QPushButton {
        background-color: #e74c3c;
    }
)");
```

### 2.6 静态资源引用

Qt 使用资源系统（Qt Resource System）管理图片、样式表等静态文件。

**资源文件结构（.qrc）**

```xml
<RCC>
    <qresource prefix="/">
        <!-- 样式表 -->
        <file>qss/style.qss</file>
        <!-- 图标 -->
        <file>images/icon_settings.svg</file>
        <file>images/logo.png</file>
    </qresource>
</RCC>
```

**在代码中引用资源**

```cpp
// 加载图片
QPixmap pixmap(":/images/logo.png");
label->setPixmap(pixmap);

// 加载图标
QIcon icon(":/images/icon_settings.svg");
button->setIcon(icon);

// 加载样式表
QFile file(":/qss/style.qss");
if (file.open(QFile::ReadOnly)) {
    qApp->setStyleSheet(file.readAll());
}
```

**在 QSS 中引用资源**

```css
QPushButton#settingsBtn {
    background-image: url(:/images/icon_settings.svg);
    background-repeat: no-repeat;
    background-position: center;
}

QWidget#mainWindow {
    border-image: url(:/images/bg.png);
}
```

**资源路径说明**

| 路径格式 | 说明 |
|---------|------|
| `:/images/logo.png` | 资源系统路径，编译到可执行文件中 |
| `qrc:/images/logo.png` | QML 中使用的资源路径 |
| `images/logo.png` | 相对文件路径（不推荐） |

### 2.7 表单 UI 开发

在工业应用中，表单是最常见的数据录入界面。推荐封装统一的表单字段组件。

**FormField 基类设计**

```cpp
class FormField : public QWidget {
    Q_OBJECT
public:
    FormField(const QString& label, bool required, QWidget* parent);

    virtual QString getValue() const = 0;
    virtual void setValue(const QString& value) = 0;
    virtual bool validate() = 0;

    void setError(const QString& message);
    void clearError();

protected:
    QLabel* m_label;
    QLabel* m_errorLabel;
    QHBoxLayout* m_horizontalLayout;
};
```

**派生类示例：TextFormField**

```cpp
class TextFormField : public FormField {
public:
    TextFormField(const QString& label, bool required,
                  const QString& placeholder, QWidget* parent);

private:
    QLineEdit* m_lineEdit;
};
```

**表单字段样式**

```css
#formInput {
    background-color: #000000;
    border: 1px solid #3a3e45;
    border-radius: 4px;
    color: #FFFFFF;
    font-size: 20px;
    padding: 15px;
}

#formInput:focus {
    border: 1px solid #2d7ff9;
}
```

**使用 QGridLayout 组织表单**

```cpp
QGridLayout* grid = new QGridLayout();
grid->setColumnStretch(0, 1);
grid->setColumnStretch(1, 1);
grid->setVerticalSpacing(15);
grid->setHorizontalSpacing(30);

// 跨两列的字段
grid->addWidget(nameField, 0, 0, 1, 2);
// 单列字段
grid->addWidget(field1, 1, 0);
grid->addWidget(field2, 1, 1);
```

**ARM 平台下拉框白屏问题**

在 ARM Linux 平台上，QComboBox 下拉列表点击后显示白屏。

| 问题 | 原因 |
|------|------|
| 下拉框白屏 | ARM 使用 OpenGL ES 渲染，Alpha 通道处理异常 |

**解决方案**

```cpp
QComboBox* combo = new QComboBox(this);

// 创建自定义 ListView 替换默认下拉视图
QListView* listView = new QListView(combo);

#ifndef _WIN32  // 仅在非 Windows 平台应用
    listView->setStyleSheet(
        "QListView { background-color: #2a2e35; color: #fff; }"
    );
    listView->setAutoFillBackground(true);
    if (listView->viewport()) {
        listView->viewport()->setAutoFillBackground(true);
    }
#endif

combo->setView(listView);
```

### 2.8 触摸设备交互原则

在触摸屏设备上，需要特别注意交互元素的尺寸和响应区域。

**按钮尺寸规范**

| 元素类型 | 最小尺寸 | 推荐尺寸 | 说明 |
|---------|---------|---------|------|
| 主要按钮 | 120×50 | 160×60 | 确认、提交等操作 |
| 工具栏图标 | 48×48 | 64×64 | 增加触摸边距 |
| 列表项 | - | 高度 50px | 便于手指点击 |
| 表单输入框 | - | 高度 60px | 包含内边距 |

**扩大可点击区域**

图标按钮应设置比图标更大的点击区域：

```cpp
// 图标 48x48，按钮 64x64，增加 8px 触摸边距
m_backButton->setFixedSize(64, 64);
m_backButton->setIconSize(QSize(48, 48));
```

---

## 三、布局系统

### 3.1 布局管理器概述

Qt 提供了多种布局管理器，用于自动排列控件：

| 布局类型 | 说明 |
|---------|------|
| `QVBoxLayout` | 垂直排列 |
| `QHBoxLayout` | 水平排列 |
| `QGridLayout` | 网格排列 |
| `QFormLayout` | 表单布局（标签-控件对） |
| `QStackedLayout` | 堆叠布局（同一位置切换显示） |

**基本用法**

```cpp
QVBoxLayout* layout = new QVBoxLayout(this);
layout->setContentsMargins(20, 20, 20, 20);  // 外边距
layout->setSpacing(10);                       // 控件间距

layout->addWidget(titleLabel);
layout->addWidget(contentWidget);
layout->addStretch();  // 弹性空间
```

### 3.2 QScrollArea 详解

QScrollArea 是一个可滚动的容器，当内容超出可视区域时自动显示滚动条。

**基本配置**

```cpp
QScrollArea* scrollArea = new QScrollArea(this);
scrollArea->setWidgetResizable(true);  // 关键属性
scrollArea->setHorizontalScrollBarPolicy(Qt::ScrollBarAlwaysOff);
scrollArea->setVerticalScrollBarPolicy(Qt::ScrollBarAsNeeded);
scrollArea->setFrameShape(QFrame::NoFrame);

QWidget* content = new QWidget();
// ... 添加内容到 content
scrollArea->setWidget(content);
```

**setWidgetResizable 的行为**

这是 QScrollArea 最重要的属性：

- `true`：内部 widget 会被调整为视口大小，然后根据 sizeHint 决定是否显示滚动条
- `false`：内部 widget 保持原始大小，超出视口则显示滚动条

### 3.3 实践中的注意事项

**注意点 1：不要对滚动内容设置固定高度**

```cpp
// ❌ 错误：固定高度会导致滚动失效
scrollContent->setFixedHeight(500);

// ✅ 正确：让内容自然增长
QVBoxLayout* layout = new QVBoxLayout(scrollContent);
layout->addWidget(form);
layout->addStretch();
```

**注意点 2：固定尺寸与弹性布局不要混用**

```cpp
// ❌ 矛盾的设计
scrollArea->setWidgetResizable(true);
m_container->setFixedSize(1230, 576);  // 固定尺寸

// ✅ 选择一种方式
// 方案 A：使用弹性布局
scrollArea->setWidgetResizable(true);
// 不设置固定尺寸

// 方案 B：使用固定尺寸，不用 QScrollArea
m_contentStack->addWidget(m_fixedPage);
```

---

## 四、表格组件开发

### 4.1 QTableWidget 基础配置

```cpp
void setupTable() {
    m_tableWidget = new QTableWidget(this);
    m_tableWidget->setObjectName("dataTable");

    // 选择行为
    m_tableWidget->setSelectionBehavior(QAbstractItemView::SelectRows);
    m_tableWidget->setSelectionMode(QAbstractItemView::SingleSelection);

    // 禁用编辑
    m_tableWidget->setEditTriggers(QAbstractItemView::NoEditTriggers);

    // 隐藏行号
    m_tableWidget->verticalHeader()->setVisible(false);

    // 表头设置
    m_tableWidget->horizontalHeader()->setStretchLastSection(true);
    m_tableWidget->horizontalHeader()->setDefaultAlignment(
        Qt::AlignLeft | Qt::AlignVCenter);

    // 行高
    m_tableWidget->verticalHeader()->setDefaultSectionSize(50);
}
```

### 4.2 滚动条样式定制

```css
/* 隐藏水平滚动条 */
#dataTable QScrollBar:horizontal {
    height: 0px;
}

/* 垂直滚动条 */
#dataTable QScrollBar:vertical {
    background: transparent;
    width: 8px;
}

/* 滑块样式 */
#dataTable QScrollBar::handle:vertical {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    min-height: 20px;
}

#dataTable QScrollBar::handle:vertical:hover {
    background: rgba(255, 255, 255, 0.3);
}
```

### 4.3 填充数据

```cpp
void loadData(const QList<DataItem>& items) {
    m_tableWidget->setRowCount(0);

    QFont cellFont;
    cellFont.setPixelSize(18);

    for (const auto& item : items) {
        int row = m_tableWidget->rowCount();
        m_tableWidget->insertRow(row);

        QTableWidgetItem* nameItem = new QTableWidgetItem(item.name);
        nameItem->setFont(cellFont);
        nameItem->setTextAlignment(Qt::AlignLeft | Qt::AlignVCenter);
        m_tableWidget->setItem(row, 0, nameItem);
    }
}
```

---

## 五、自定义组件

### 5.1 轮播图组件

**核心结构**

```cpp
class DeviceCarousel : public QWidget {
    Q_OBJECT
public:
    DeviceCarousel(QWidget* parent = nullptr);

private:
    QStackedWidget* m_stackWidget;  // 卡片容器
    QPushButton* m_prevBtn;         // 左箭头
    QPushButton* m_nextBtn;         // 右箭头
    int m_currentIndex;
};
```

**切换动画**

```cpp
void switchToIndex(int index) {
    // 使用 QGraphicsOpacityEffect 实现淡入淡出
    QGraphicsOpacityEffect* effect = new QGraphicsOpacityEffect(m_stackWidget);
    m_stackWidget->setGraphicsEffect(effect);

    QPropertyAnimation* anim = new QPropertyAnimation(effect, "opacity");
    anim->setDuration(200);
    anim->setStartValue(1.0);
    anim->setEndValue(0.0);

    connect(anim, &QPropertyAnimation::finished, [=]( "=") {
        m_stackWidget->setCurrentIndex(index);
        // 淡入动画...
    });

    anim->start(QAbstractAnimation::DeleteWhenStopped);
}
```

### 5.2 分页器组件

```cpp
void setupPagination() {
    QHBoxLayout* layout = new QHBoxLayout();

    m_prevButton = new QPushButton(tr("上一页"));
    m_prevButton->setFlat(true);
    m_prevButton->setStyleSheet(R"(
        QPushButton { color: #888; border: none; }
        QPushButton:hover { color: #CCC; }
        QPushButton:disabled { color: #444; }
    )");

    m_nextButton = new QPushButton(tr("下一页"));
    // 类似配置...

    layout->addStretch();
    layout->addWidget(m_prevButton);
    layout->addWidget(m_nextButton);
    layout->addStretch();
}

void updatePagination() {
    m_prevButton->setEnabled(m_currentPage > 1);
    m_nextButton->setEnabled(m_currentPage < m_totalPages);
}
```

---

## 六、图表组件开发

在工业监控应用中，数据可视化是核心功能之一。Qt Charts 模块提供了丰富的图表类型，适合展示实时数据和历史趋势。

### 6.1 Qt Charts 模块简介

Qt Charts 是 Qt 官方提供的图表库，支持多种图表类型：

| 图表类型 | 类名 | 适用场景 |
|---------|------|---------|
| 折线图 | QLineSeries | 时间序列、趋势分析 |
| 柱状图 | QBarSeries | 分类对比 |
| 饼图 | QPieSeries | 占比分析 |
| 散点图 | QScatterSeries | 数据分布 |
| 面积图 | QAreaSeries | 累积趋势 |

**引入 Qt Charts**

```cpp
// .pro 文件中添加
QT += charts

// 头文件引入
#include <QtCharts/QChartView>
#include <QtCharts/QLineSeries>
#include <QtCharts/QChart>
#include <QtCharts/QValueAxis>

// 使用命名空间
using namespace QtCharts;
```

### 6.2 创建基础折线图

**初始化图表**

```cpp
void setupChart() {
    // 创建图表对象
    m_chart = new QChart();
    m_chart->setBackgroundVisible(false);  // 透明背景
    m_chart->setMargins(QMargins(10, 10, 10, 10));
    m_chart->setAnimationOptions(QChart::SeriesAnimations);
    m_chart->legend()->setVisible(false);  // 隐藏默认图例

    // 创建图表视图
    m_chartView = new QChartView(m_chart);
    m_chartView->setRenderHint(QPainter::Antialiasing);
    m_chartView->setStyleSheet("background: transparent;");
}
```

**创建数据系列**

```cpp
void createSeries() {
    // 创建折线系列
    QLineSeries* series = new QLineSeries();
    series->setName("储能功率");

    // 设置线条样式
    QPen pen(QColor("#6E59F3"));  // 紫色
    pen.setWidth(3);
    series->setPen(pen);

    // 添加数据点
    for (int hour = 0; hour <= 24; ++hour) {
        double value = qSin(hour * 0.5) * 1000 + 500;
        series->append(hour, value);
    }

    // 添加到图表
    m_chart->addSeries(series);
}
```

### 6.3 坐标轴配置

**创建 X 轴（时间轴）**

```cpp
QValueAxis* createXAxis() {
    QValueAxis* axisX = new QValueAxis();
    axisX->setRange(0, 24);
    axisX->setTickCount(13);  // 0, 2, 4, ..., 24
    axisX->setLabelFormat("%d");
    axisX->setLabelsColor(QColor("#999999"));
    axisX->setGridLineColor(QColor("#333333"));
    axisX->setGridLineVisible(true);

    QFont font;
    font.setPixelSize(14);
    axisX->setLabelsFont(font);

    return axisX;
}
```

**创建 Y 轴**

```cpp
QValueAxis* createYAxis() {
    QValueAxis* axisY = new QValueAxis();
    axisY->setRange(-2500, 10000);
    axisY->setTickCount(6);
    axisY->setLabelFormat("%.0f");
    axisY->setLabelsColor(QColor("#999999"));
    axisY->setGridLineColor(QColor("#333333"));

    return axisY;
}
```

**关联坐标轴与数据系列**

```cpp
void bindAxes() {
    QValueAxis* axisX = createXAxis();
    QValueAxis* axisY = createYAxis();

    m_chart->addAxis(axisX, Qt::AlignBottom);
    m_chart->addAxis(axisY, Qt::AlignLeft);

    // 将系列关联到坐标轴
    m_series->attachAxis(axisX);
    m_series->attachAxis(axisY);
}
```

### 6.4 双 Y 轴图表

在能源监控场景中，常需要同时显示功率（kW）和 SOC（%）两种不同量纲的数据。

```cpp
void setupDualYAxis() {
    // 左 Y 轴：功率 (kW)
    QValueAxis* axisYLeft = new QValueAxis();
    axisYLeft->setRange(-2500, 10000);
    axisYLeft->setTitleText("单位 (kW)");
    m_chart->addAxis(axisYLeft, Qt::AlignLeft);

    // 右 Y 轴：SOC (%)
    QValueAxis* axisYRight = new QValueAxis();
    axisYRight->setRange(0, 100);
    axisYRight->setTitleText("SOC (%)");
    m_chart->addAxis(axisYRight, Qt::AlignRight);

    // 功率系列关联左 Y 轴
    m_powerSeries->attachAxis(axisX);
    m_powerSeries->attachAxis(axisYLeft);

    // SOC 系列关联右 Y 轴
    m_socSeries->attachAxis(axisX);
    m_socSeries->attachAxis(axisYRight);
}
```

### 6.5 自定义图例

Qt Charts 的默认图例样式有限，推荐使用自定义 Widget 实现：

```cpp
QWidget* createCustomLegend() {
    QWidget* legend = new QWidget(m_chartView);
    QHBoxLayout* layout = new QHBoxLayout(legend);
    layout->setSpacing(20);

    // 图例项数据
    struct LegendItem {
        QString name;
        QColor color;
    };
    QList<LegendItem> items = {
        {"储能实时功率", QColor("#6E59F3")},
        {"储能功率指令", QColor("#1A55FE")},
        {"实时需量", QColor("#67C23A")},
        {"在线SOC", QColor("#FFD50C")}
    };

    for (const auto& item : items) {
        QWidget* itemWidget = new QWidget();
        QHBoxLayout* itemLayout = new QHBoxLayout(itemWidget);
        itemLayout->setContentsMargins(0, 0, 0, 0);
        itemLayout->setSpacing(5);

        // 颜色标记
        QLabel* marker = new QLabel();
        marker->setFixedSize(10, 10);
        marker->setStyleSheet(QString(
            "background-color: %1; border-radius: 5px;"
        ).arg(item.color.name()));

        // 文字标签
        QLabel* label = new QLabel(item.name);
        label->setStyleSheet("color: #CCCCCC; font-size: 14px;");

        itemLayout->addWidget(marker);
        itemLayout->addWidget(label);
        layout->addWidget(itemWidget);
    }

    return legend;
}
```

### 6.6 实时数据更新

**动态添加数据点**

```cpp
void appendDataPoint(double x, double y) {
    m_series->append(x, y);

    // 保持固定数据点数量（滑动窗口）
    const int MAX_POINTS = 100;
    if (m_series->count() > MAX_POINTS) {
        m_series->remove(0);
    }

    // 更新 X 轴范围
    double minX = m_series->at(0).x();
    double maxX = m_series->at(m_series->count() - 1).x();
    m_axisX->setRange(minX, maxX);
}
```

**清空并重新填充数据**

```cpp
void updateChartData(const QList<DataPoint>& data) {
    m_series->clear();

    for (const auto& point : data) {
        m_series->append(point.timestamp, point.value);
    }

    // 自动调整 Y 轴范围
    double minY = std::numeric_limits<double>::max();
    double maxY = std::numeric_limits<double>::lowest();
    for (const auto& point : data) {
        minY = qMin(minY, point.value);
        maxY = qMax(maxY, point.value);
    }
    m_axisY->setRange(minY * 0.9, maxY * 1.1);
}
```

### 6.7 图表样式定制

**深色主题配置**

```cpp
void applyDarkTheme() {
    // 背景透明
    m_chart->setBackgroundVisible(false);

    // 坐标轴颜色
    QColor axisColor("#999999");
    QColor gridColor("#333333");

    for (auto axis : m_chart->axes()) {
        QValueAxis* valueAxis = qobject_cast<QValueAxis*>(axis);
        if (valueAxis) {
            valueAxis->setLabelsColor(axisColor);
            valueAxis->setGridLineColor(gridColor);
            valueAxis->setLinePenColor(gridColor);
        }
    }
}
```

**QSS 样式**

```css
/* 图表视图背景 */
QChartView {
    background: transparent;
}

/* 图表容器 */
#chartContainer {
    background: qlineargradient(
        x1:0, y1:0, x2:0, y2:1,
        stop:0 #1a1d23,
        stop:1 #0d0f12
    );
    border-radius: 8px;
}
```

### 6.8 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 图表不显示 | 未添加坐标轴或未关联系列 | 确保调用 addAxis() 和 attachAxis() |
| 数据点超出范围 | Y 轴范围设置不当 | 根据数据动态调整 setRange() |
| 图例位置错误 | 默认图例布局限制 | 使用自定义 Widget 图例 |
| 性能问题 | 数据点过多 | 使用数据采样或 QOpenGLWidget |

---

## 七、虚拟键盘

对于嵌入式触摸屏设备，虚拟键盘是用户输入的核心组件。

### 7.1 Qt Virtual Keyboard 简介

Qt Virtual Keyboard 是 Qt 官方提供的虚拟键盘模块，支持：
- 多语言输入（中文拼音、英文等）
- 可定制的键盘布局
- 与 Qt Widgets 和 QML 集成

**启用虚拟键盘**

```cpp
// main.cpp - 必须在 QApplication 之前设置
int main(int argc, char *argv[]) {
    qputenv("QT_IM_MODULE", QByteArray("qtvirtualkeyboard"));

    QApplication app(argc, argv);
    // ...
}
```

### 7.2 架构设计

推荐使用**单例 + 全局事件过滤器**的架构：

```
MainWindow
├── 全局事件过滤器（监听焦点事件）
├── VirtualKeyboardWidget（单例）
└── 各个页面（使用 QScrollArea）
```

**核心组件**

```cpp
class VirtualKeyboardWidget : public QQuickWidget {
    Q_OBJECT
public:
    static VirtualKeyboardWidget* instance();
    void showKeyboard();
    void hideKeyboard();

signals:
    void keyboardVisibilityChanged(bool visible);

private:
    static VirtualKeyboardWidget* s_instance;
};
```

### 7.3 焦点管理

**关键设置：键盘不抢夺焦点**

```cpp
void VirtualKeyboardWidget::setupUI() {
    setAttribute(Qt::WA_ShowWithoutActivating);  // 显示时不激活
    setFocusPolicy(Qt::NoFocus);                 // 不接受焦点
    setAttribute(Qt::WA_AcceptTouchEvents);      // 接收触摸事件
}
```

**全局事件过滤器**

```cpp
// MainWindow 构造函数中
qApp->installEventFilter(this);

bool MainWindow::eventFilter(QObject* obj, QEvent* event) {
    QLineEdit* lineEdit = qobject_cast<QLineEdit*>(obj);
    if (lineEdit) {
        if (event->type() == QEvent::FocusIn) {
            m_keyboardHideTimer->stop();
            m_keyboard->showKeyboard();
        }
        else if (event->type() == QEvent::FocusOut) {
            m_keyboardHideTimer->start(300);
        }
    }
    return QMainWindow::eventFilter(obj, event);
}
```

### 7.4 智能滚动

当键盘弹出时，需要自动滚动让输入框可见：

```cpp
void MainWindow::adjustLayoutForKeyboard(bool visible) {
    const int KEYBOARD_HEIGHT = 480;

    if (visible) {
        QWidget* focusWidget = QApplication::focusWidget();
        QScrollArea* scrollArea = findParentScrollArea(focusWidget);

        if (scrollArea) {
            QLayout* layout = scrollArea->widget()->layout();
            QMargins margins = layout->contentsMargins();

            // 增加底部边距
            layout->setContentsMargins(
                margins.left(), margins.top(), margins.right(),
                margins.bottom() + KEYBOARD_HEIGHT
            );

            // 滚动到焦点控件
            scrollArea->ensureWidgetVisible(focusWidget);
        }
    }
}
```

### 7.5 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 键盘不显示 | QT_IM_MODULE 未设置 | main.cpp 中设置环境变量 |
| 无法输入 | 键盘抢夺焦点 | 设置 WA_ShowWithoutActivating |
| 输入框被遮挡 | 缺少 QScrollArea | 用 QScrollArea 包装表单 |
| 切换时闪烁 | 隐藏定时器未取消 | FocusIn 时停止定时器 |

---

## 八、国际化（i18n）

Qt 提供了完整的国际化支持，可以让应用程序轻松支持多语言。

### 8.1 Qt 国际化概述

**核心概念**

- **tr() 宏**：标记需要翻译的字符串
- **.ts 文件**：XML 格式的翻译源文件，用于编辑
- **.qm 文件**：二进制格式的翻译文件，运行时加载
- **lupdate**：从源代码提取可翻译字符串
- **lrelease**：将 .ts 编译为 .qm

**基本用法**

```cpp
// 使用 tr() 标记可翻译字符串
QPushButton* btn = new QPushButton(tr("确定"));
QLabel* label = new QLabel(tr("用户名："));
```

### 8.2 翻译管理器设计

推荐使用单例模式管理翻译：

```cpp
class TranslationManager : public QObject {
    Q_OBJECT
public:
    enum Language { Chinese, English };

    static TranslationManager& instance();
    void initialize(QApplication* app);
    void setLanguage(Language lang);
    Language currentLanguage() const;

signals:
    void languageChanged();

private:
    QTranslator* m_translator;
    Language m_currentLanguage;
};
```

### 8.3 加载翻译文件

```cpp
void TranslationManager::setLanguage(Language lang) {
    // 移除旧翻译器
    if (m_translator) {
        m_app->removeTranslator(m_translator);
    }

    // 加载新翻译文件
    QString fileName = (lang == English) ? "app_en_US" : "app_zh_CN";
    if (m_translator->load(fileName, ":/translations")) {
        m_app->installTranslator(m_translator);
    }

    m_currentLanguage = lang;
    emit languageChanged();
}
```

### 8.4 动态语言切换

实现 retranslateUi() 方法支持运行时切换：

```cpp
void MyWidget::retranslateUi() {
    m_titleLabel->setText(tr("标题"));
    m_submitBtn->setText(tr("提交"));
}
```

**在 MainWindow 中连接信号**

```cpp
// 构造函数中
connect(&TranslationManager::instance(),
        &TranslationManager::languageChanged,
        this, &MainWindow::retranslateUi);
```

### 8.5 翻译工作流程

```bash
# 1. 提取可翻译字符串
lupdate src/ -ts translations/app_en_US.ts

# 2. 使用 Qt Linguist 翻译

# 3. 编译翻译文件
lrelease translations/app_en_US.ts
```

### 8.6 常见问题

| 问题 | 解决方案 |
|------|----------|
| 非 QObject 类无法使用 tr() | 使用 `QCoreApplication::translate("ClassName", "文本")` |
| 动态生成的文本 | 在生成时调用 tr()，而非存储翻译后的字符串 |
| 切换语言后部分文本未更新 | 确保组件实现了 retranslateUi() 并被调用 |

---

## 九、屏幕保护与事件处理

### 9.1 屏幕保护设计

屏幕保护需要满足：
- 空闲检测：无操作一段时间后激活
- 状态保存：保存当前页面状态
- 无缝恢复：退出时恢复之前页面

### 9.2 定时器轮询检测

当模态对话框存在时，事件可能无法正常传递。使用定时器主动检测：

```cpp
void ScreenSaverPage::checkUserInteraction() {
    // 检测鼠标按钮
    bool pressed = QApplication::mouseButtons() != Qt::NoButton;
    if (pressed && !m_lastButtonState) {
        hide();
        return;
    }
    m_lastButtonState = pressed;

    // 检测鼠标移动
    QPoint pos = QCursor::pos();
    if ((pos - m_lastPos).manhattanLength() > 10) {
        hide();
    }
    m_lastPos = pos;
}
```

### 9.3 跨平台窗口标志

```cpp
// Windows
setWindowFlags(Qt::Window | Qt::WindowStaysOnTopHint);

// ARM/Linux - 绕过窗口管理器
setWindowFlags(Qt::Window | Qt::X11BypassWindowManagerHint);
```

---

## 十、总结

Qt 作为跨平台的 C++ 应用框架，在嵌入式触摸屏开发领域具有显著优势。它提供了完整的 UI 组件库和布局系统，能够快速构建专业的工业界面；QSS 样式表让界面定制变得简单直观；信号槽机制实现了优雅的组件间通信；而 Qt Virtual Keyboard 等模块则为触摸屏场景提供了开箱即用的解决方案。更重要的是，Qt 的跨平台特性使得同一套代码可以在 Windows 开发环境调试，然后无缝部署到 ARM Linux 设备上。

这些经验来自真实项目的踩坑与实践，希望能为从事嵌入式 Qt 开发的同行提供参考。

### 参考资源

- [Qt Style Sheets Reference](https://doc.qt.io/qt-5/stylesheet-reference.html "Qt Style Sheets Reference")
- [Qt Virtual Keyboard](https://doc.qt.io/qt-5/qtvirtualkeyboard-index.html "Qt Virtual Keyboard")
- [Qt Internationalization](https://doc.qt.io/qt-5/internationalization.html "Qt Internationalization")
- [QScrollArea Documentation](https://doc.qt.io/qt-5/qscrollarea.html "QScrollArea Documentation")

---

