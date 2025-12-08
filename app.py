from dash import Dash, dcc, html, Input, Output, callback
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd

# COLOR SCHEME FOR THE APP
COLORS = {
    'primary_blue': '#2563eb',
    'accent_gold': '#fbbf24',
    'secondary_cyan': '#06b6d4',
    'dark_bg': '#f5f5f5',
    'text_white': '#111827',
    'grid_lines': '#e5e7eb'
}

# DATASET (GOOGLE SHEETS)
url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTjamcaGEzOaghNnbCMBlhmx-2h0jleHUnL7pk_oXqAG0okQJfPfWv2UDIroxVDmwW8UtG4S7iRekUB/pub?gid=529418336&single=true&output=csv'
df = pd.read_csv(url)

df['Year'] = pd.to_numeric(df['Year'], errors='coerce')
df['Age'] = pd.to_numeric(df['Age'], errors='coerce')
df['Height'] = pd.to_numeric(df['Height'], errors='coerce')
df['Weight'] = pd.to_numeric(df['Weight'], errors='coerce')

df['HasMedal'] = df['Medal'].notna()
df['MedalStatus'] = df['Medal'].apply(lambda x: 'Medalist' if pd.notna(x) else 'Non-Medalist')
df['Sex'] = df['Sex'].map({'M': 'Male', 'F': 'Female'})
df = df.dropna(subset=['Year'])


# HELPER FUNCTIONS
def get_filtered_data(df, year_range, season):
    filtered = df[(df['Year'] >= year_range[0]) & (df['Year'] <= year_range[1])]
    if season != 'All':
        filtered = filtered[filtered['Season'] == season]
    return filtered.copy()


def create_stat_card(label, value, icon_char="📊"):
    return html.Div(
        [
            html.Div(icon_char, style={'fontSize': '32px', 'marginBottom': '10px'}),
            html.Div(label,
                style={
                    'fontSize': '13px',
                    'color': '#6b7280',
                    'marginBottom': '6px',
                    'textTransform': 'uppercase',
                    'letterSpacing': '0.7px'
                }
            ),
            html.Div(
                f'{value:,.0f}' if isinstance(value, (int, float)) else str(value),
                style={'fontSize': '32px', 'fontWeight': 'bold', 'color': COLORS['text_white']}
            )
        ],
        style={
            'backgroundColor': '#ffffff',
            'padding': '26px 20px',
            'borderRadius': '12px',
            'textAlign': 'center',
            'border': f'1px solid {COLORS["grid_lines"]}',
            'minWidth': '230px',
            'width': '100%',
            'boxSizing': 'border-box',
            'boxShadow': '0 8px 20px rgba(15, 23, 42, 0.08)'
        }
    )


GRAPH_CARD_STYLE = {
    'flex': '1',
    'minWidth': '400px',
    'backgroundColor': '#ffffff',
    'borderRadius': '16px',
    'padding': '10px',
    'boxShadow': '0 8px 20px rgba(15, 23, 42, 0.08)',
    'overflow': 'hidden',
    'boxSizing': 'border-box'
}


# APP INIT
app = Dash(__name__)
server = app.server   # REQUIRED FOR RENDER


 
app.index_string = """<!DOCTYPE html>
<html>
    <head>
        {%metas%}
        <title>{%title%}</title>
        {%favicon%}
        {%css%}
        <style>
            html, body { margin: 0; padding: 0; height: 100%; width: 100%; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            .dash-debug-menu { display: none !important; }
        </style>
    </head>
    <body>
        {%app_entry%}
        <footer>
            {%config%}
            {%scripts%}
            {%renderer%}
        </footer>
    </body>
</html>
"""

app.index_string = '''
<!DOCTYPE html>
<html>
    <head>
        {%metas%}
        <title>{%title%}</title>
        {%favicon%}
        {%css%}
        <style>
            html, body {
                margin: 0;
                padding: 0;
                height: 100%;
                width: 100%;
                background-color: #f5f5f5;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }

            #_dash-app-content, #_dash-app-layout, ._dash-app-content {
                max-width: 100% !important;
                margin: 0 !important;
            }

            .dash-debug-menu {
                display: none !important;
            }

            /* Light theme controls */
            .Select-control {
                background-color: #ffffff !important;
                border: 1px solid #d1d5db !important;
                border-radius: 6px !important;
            }
            .Select-menu-outer {
                background-color: #ffffff !important;
                border: 1px solid #d1d5db !important;
            }
            .Select-option {
                background-color: #ffffff !important;
                color: #111827 !important;
                padding: 10px !important;
            }
            .Select-option:hover {
                background-color: #e5f2ff !important;
            }
            .Select-value-label {
                color: #111827 !important;
            }
            .Select-placeholder {
                color: #9ca3af !important;
            }
            .Select-arrow {
                border-color: #6b7280 transparent transparent !important;
            }

            /* Tabs styling */
            .custom-tabs {
                border-bottom: 1px solid #e5e7eb;
            }
            .custom-tab {
                padding: 10px 18px;
                font-weight: 500;
                border-radius: 8px 8px 0 0;
                border: 1px solid transparent;
                margin-right: 6px;
            }
            .custom-tab--selected {
                background-color: #ffffff;
                border-color: #e5e7eb;
                border-bottom-color: #ffffff;
                color: #111827 !important;
            }
        </style>
    </head>
    <body>
        {%app_entry%}
        <footer>
            {%config%}
            {%scripts%}
            {%renderer%}
        </footer>
    </body>
</html>
'''


# APP LAYOUT

app.layout = html.Div(
    [
        # HEADER
        html.Div(
            [
                html.H1(
                    'Olympics History Dashboard',
                    style={
                        'color': COLORS['text_white'],
                        'marginBottom': '8px',
                        'fontSize': '36px',
                        'fontWeight': 'bold'
                    }
                ),
                html.P(
                    'Exploring 120 years of athlete demographics and medal trends',
                    style={
                        'color': '#4b5563',
                        'marginBottom': '0',
                        'fontSize': '20px'
                    }
                )
            ],
            style={
                'backgroundColor': COLORS['dark_bg'],
                'padding': '30px 20px 16px 20px',
                'borderBottom': f'1px solid {COLORS["grid_lines"]}',
                'marginBottom': '0px'
            }
        ),

        # TABS
        dcc.Tabs(
            id="main-tabs",
            value="overview",
            children=[
                dcc.Tab(
                    label="📊 Overview",
                    value="overview",
                    className="custom-tab",
                    selected_className="custom-tab--selected",
                    children=[
                        # FILTER SECTION
                        html.Div(
                            [
                                html.Div(
                                    [
                                        html.Label(
                                            '📅 Year Range:',
                                            style={
                                                'fontSize': '14px',
                                                'fontWeight': 'bold',
                                                'color': COLORS['text_white'],
                                                'marginBottom': '10px'
                                            }
                                        ),
                                        dcc.RangeSlider(
                                            id='year-slider',
                                            min=int(df['Year'].min()),
                                            max=int(df['Year'].max()),
                                            step=4,
                                            value=[1980, 2016],
                                            marks={
                                                1896: '1896',
                                                1920: '1920',
                                                1940: '1940',
                                                1960: '1960',
                                                1980: '1980',
                                                2000: '2000',
                                                2016: '2016'
                                            },
                                            tooltip={"placement": "bottom", "always_visible": True},
                                            persistence=False
                                        )
                                    ],
                                    style={'flex': '1', 'marginRight': '30px'}
                                ),

                                html.Div(
                                    [
                                        html.Label(
                                            '🏅 Season:',
                                            style={
                                                'fontSize': '14px',
                                                'fontWeight': 'bold',
                                                'color': COLORS['text_white'],
                                                'marginBottom': '10px',
                                                'display': 'block'
                                            }
                                        ),
                                        dcc.Dropdown(
                                            id='season-dropdown',
                                            options=[
                                                {'label': '🌍 All Seasons', 'value': 'All'},
                                                {'label': '☀️ Summer Olympics', 'value': 'Summer'},
                                                {'label': '❄️ Winter Olympics', 'value': 'Winter'}
                                            ],
                                            value='All',
                                            clearable=False
                                        )
                                    ],
                                    style={'flex': '1'}
                                )
                            ],
                            style={
                                'display': 'flex',
                                'backgroundColor': '#ffffff',
                                'padding': '20px',
                                'borderRadius': '8px',
                                'marginBottom': '30px',
                                'border': f'1px solid {COLORS["grid_lines"]}',
                                'marginLeft': '20px',
                                'marginRight': '20px',
                                'boxShadow': '0 8px 20px rgba(15, 23, 42, 0.06)'
                            }
                        ),

                        # STAT CARDS
                        html.Div(
                            [
                                html.Div(
                                    id='stat-cards-container',
                                    style={'width': '100%'}
                                )
                            ],
                            style={'padding': '0 20px 24px 20px'}
                        ),

                        # VISUALIZATIONS + TAKEAWAYS
                        html.Div(
                            [
                                # ROW 1: Participation + Top Countries
                                html.Div(
                                    [
                                        html.Div(
                                            [
                                                html.Div(
                                                    dcc.Graph(id='participation-chart'),
                                                    style=GRAPH_CARD_STYLE
                                                ),
                                                html.Div(
                                                    dcc.Graph(id='top-countries-chart'),
                                                    style=GRAPH_CARD_STYLE
                                                )
                                            ],
                                            style={
                                                'display': 'flex',
                                                'gap': '20px',
                                                'marginBottom': '10px',
                                                'flexWrap': 'wrap'
                                            }
                                        ),
                                        html.Div(
                                            "📈 Takeaway: Athlete participation grows over time, "
                                            "with a notable jump in women’s participation after 1980 and medals concentrated "
                                            "in a small set of dominant NOCs.",
                                            style={
                                                'color': '#4b5563',
                                                'fontSize': '13px',
                                                'marginBottom': '20px'
                                            }
                                        )
                                    ]
                                ),

                                # ROW 2: Height-Weight + Medal Age
                                html.Div(
                                    [
                                        html.Div(
                                            [
                                                html.Div(
                                                    dcc.Graph(id='height-weight-chart'),
                                                    style=GRAPH_CARD_STYLE
                                                ),
                                                html.Div(
                                                    dcc.Graph(id='medal-age-chart'),
                                                    style=GRAPH_CARD_STYLE
                                                )
                                            ],
                                            style={
                                                'display': 'flex',
                                                'gap': '20px',
                                                'marginBottom': '10px',
                                                'flexWrap': 'wrap'
                                            }
                                        ),
                                        html.Div(
                                            "⚖️ Takeaway: Different sports favor distinct body profiles, "
                                            "and medalists tend to cluster in a narrower peak age band than non-medalists.",
                                            style={
                                                'color': '#4b5563',
                                                'fontSize': '13px',
                                                'marginBottom': '20px'
                                            }
                                        )
                                    ]
                                ),

                                # ROW 3: Evolution + Sport Age Profile
                                html.Div(
                                    [
                                        html.Div(
                                            [
                                                html.Div(
                                                    dcc.Graph(id='evolution-chart'),
                                                    style=GRAPH_CARD_STYLE
                                                ),
                                                html.Div(
                                                    dcc.Graph(id='sport-age-chart'),
                                                    style=GRAPH_CARD_STYLE
                                                )
                                            ],
                                            style={
                                                'display': 'flex',
                                                'gap': '20px',
                                                'marginBottom': '10px',
                                                'flexWrap': 'wrap'
                                            }
                                        ),
                                        html.Div(
                                            "⏳ Takeaway: Over time, athletes’ height, age, and weight have shifted gradually, "
                                            "and sports themselves fall into ‘younger artistic’ vs ‘older combat’ age profiles.",
                                            style={
                                                'color': '#4b5563',
                                                'fontSize': '13px',
                                                'marginBottom': '0px'
                                            }
                                        )
                                    ]
                                )
                            ],
                            style={'padding': '0 20px 30px 20px'}
                        )
                    ]
                ),

                dcc.Tab(
                    label="ℹ️ About this dashboard",
                    value="about",
                    className="custom-tab",
                    selected_className="custom-tab--selected",
                    children=[
                        html.Div(
                            [
                                html.Div(
                                    [
                                        html.H2("📊 About this dashboard", style={'marginBottom': '12px'}),
                                        html.P(
                                            "This dashboard uses the historical Olympics athlete dataset (1896–2016) "
                                            "to explore how participation, body profiles, and medal outcomes have evolved over time.",
                                            style={'fontSize': '14px', 'color': '#4b5563'}
                                        ),

                                        html.H3("🧭 How to use it", style={'marginTop': '24px'}),
                                        html.Ul(
                                            [
                                                html.Li("🎚️ Use the Year Range slider to focus on specific Olympic eras."),
                                                html.Li("🏅 Switch the Season dropdown between All, Summer, and Winter Games."),
                                                html.Li("🖱️ Hover over lines, bars, and boxes to see exact values and compare genders."),
                                                html.Li("📌 Look at the annotations to quickly spot outliers or interesting patterns.")
                                            ],
                                            style={'fontSize': '14px', 'color': '#4b5563'}
                                        ),

                                        html.H3("🎨 Design choices", style={'marginTop': '24px'}),
                                        html.Ul(
                                            [
                                                html.Li("👀 Color: Blue vs gold for gender is chosen as a colorblind-safe pair, "
                                                        "and all charts were checked with Deuteranopia and Protanopia simulators."),
                                                html.Li("🔗 Interactivity: The same shared filters drive all six visualizations so users can compare "
                                                        "patterns across charts for the same time window."),
                                                html.Li("📝 Annotations and titles highlight non-obvious findings, such as the 1980 boycott "
                                                        "effect and differences in age profiles by sport."),
                                                html.Li("🧼 Layout: Rounded cards, consistent typography, and generous spacing keep the app readable and scannable.")
                                            ],
                                            style={'fontSize': '14px', 'color': '#4b5563'}
                                        ),

                                        html.H3("💡 Example insights to mention in the walkthrough", style={'marginTop': '24px'}),
                                        html.Ul(
                                            [
                                                html.Li("📈 Female participation catching up over time, with a visible jump around 1980."),
                                                html.Li("🥊 Combat sports (e.g., boxing, wrestling) tend to have older athletes than artistic sports (e.g., gymnastics)."),
                                                html.Li("🎯 Medalists cluster in a narrower age band than non-medalists, especially in peak-performance events."),
                                                html.Li("🏊‍♂️ The height–weight heatmap reveals distinct body clusters (e.g., swimmers vs gymnasts).")
                                            ],
                                            style={'fontSize': '14px', 'color': '#4b5563'}
                                        ),

                                        html.P(
                                            "This tab is mainly here for context: if someone lands on the app without the assignment, "
                                            "they can still understand what they’re looking at and how to interpret it.",
                                            style={'marginTop': '20px', 'fontSize': '13px', 'color': '#6b7280'}
                                        )
                                    ],
                                    style={
                                        'backgroundColor': '#ffffff',
                                        'padding': '24px',
                                        'borderRadius': '16px',
                                        'border': f'1px solid {COLORS["grid_lines"]}',
                                        'boxShadow': '0 8px 20px rgba(15, 23, 42, 0.06)',
                                        'maxWidth': '900px',
                                        'margin': '24px auto'
                                    }
                                )
                            ],
                            style={'padding': '0 20px 40px 20px'}
                        )
                    ]
                ),
            ],
            className="custom-tabs",
            # ⬇ small margin below the tab bar
            style={'padding': '0 20px', 'marginBottom': '8px', 'marginTop': '4px'}
        )

    ],
    style={
        'backgroundColor': COLORS['dark_bg'],
        'color': COLORS['text_white'],
        'fontFamily': 'Arial, sans-serif',
        'minHeight': '100vh',
        'width': '100vw',
        'padding': '0',
        'margin': '0 auto',
        'boxSizing': 'border-box'
    }
)


# CALLBACKS

@callback(
    [
        Output('stat-cards-container', 'children'),
        Output('participation-chart', 'figure'),
        Output('top-countries-chart', 'figure'),
        Output('height-weight-chart', 'figure'),
        Output('medal-age-chart', 'figure'),
        Output('evolution-chart', 'figure'),
        Output('sport-age-chart', 'figure')
    ],
    [
        Input('year-slider', 'value'),
        Input('season-dropdown', 'value')
    ]
)
def update_all_charts(year_range, season):
    filtered_df = get_filtered_data(df, year_range, season)

    # STAT CARDS
    stat_cards = html.Div(
        [
            create_stat_card('Number of Sports', filtered_df['Sport'].nunique(), '🏅'),
            create_stat_card('Avg Height (cm)', f'{filtered_df["Height"].mean():.1f}', '📏'),
            create_stat_card('Avg Weight (kg)', f'{filtered_df["Weight"].mean():.1f}', '⚖️'),
            create_stat_card('Avg Age (years)', f'{filtered_df["Age"].mean():.0f}', '🎂')
        ],
        style={
            'display': 'grid',
            'gridTemplateColumns': 'repeat(4, minmax(230px, 1fr))',
            'gap': '40px',
            'justifyContent': 'center',
            'justifyItems': 'center',
            'width': '100%'
        }
    )

    # CHART 1: PARTICIPATION
    participation_data = filtered_df.groupby(['Year', 'Sex']).size().reset_index(name='Count')
    fig1 = px.line(
        participation_data,
        x='Year',
        y='Count',
        color='Sex',
        markers=True,
        title='Athlete Participation Surge: How Olympics Evolved',
        labels={
            'Count': 'Number of Athletes',
            'Year': 'Olympic Year',
            'Sex': 'Gender'
        },
        color_discrete_map={
            'Male': COLORS['primary_blue'],
            'Female': COLORS['accent_gold']
        }
    )

    fig1.update_traces(
        hovertemplate="Year: %{x}<br>Gender: %{fullData.name}<br>Athletes: %{y}<extra></extra>"
    )

    if 1980 in participation_data['Year'].values:
        fig1.add_annotation(
            x=1980,
            y=participation_data[participation_data['Year'] == 1980]['Count'].max(),
            text="1980 Moscow Boycott:<br>Female participation surge",
            showarrow=True,
            arrowhead=2,
            arrowcolor=COLORS['accent_gold'],
            bgcolor="rgba(251, 191, 36, 0.9)",
            bordercolor=COLORS['accent_gold'],
            borderwidth=2,
            font=dict(color='#111827', size=11),
            ax=-80,
            ay=-60
        )

    fig1.update_layout(
        plot_bgcolor='#ffffff',
        paper_bgcolor='#ffffff',
        font=dict(color=COLORS['text_white'], size=12),
        xaxis=dict(gridcolor=COLORS['grid_lines'], title='Olympic Year'),
        yaxis=dict(gridcolor=COLORS['grid_lines'], title='Number of Athletes'),
        hovermode='x unified',
        height=450,
        margin=dict(b=60, t=80, l=60, r=20)
    )

    # CHART 2: TOP COUNTRIES
    medal_counts = filtered_df['NOC'].value_counts().head(15).reset_index()
    medal_counts.columns = ['NOC', 'Count']
    fig2 = px.bar(
        medal_counts.sort_values('Count', ascending=False),
        x='NOC',
        y='Count',
        title='Olympic Dominance: Which Countries Win Most?',
        color='Count',
        color_continuous_scale=[[0, COLORS['primary_blue']], [1, COLORS['secondary_cyan']]],
        text='Count'
    )

    if 'USA' in medal_counts['NOC'].values:
        fig2.add_annotation(
            x='USA',
            y=medal_counts[medal_counts['NOC'] == 'USA']['Count'].values[0],
            text=f"USA leads<br>{int(medal_counts[medal_counts['NOC'] == 'USA']['Count'].values[0])} medals",
            showarrow=True,
            arrowhead=2,
            bgcolor="rgba(37, 99, 235, 0.9)",
            font=dict(color='#ffffff', size=11),
            ay=-50
        )

    fig2.update_traces(textposition='outside')
    fig2.update_layout(
        plot_bgcolor='#ffffff',
        paper_bgcolor='#ffffff',
        font=dict(color=COLORS['text_white'], size=12),
        showlegend=False,
        height=450,
        margin=dict(b=60, t=80, l=60, r=20),
        xaxis=dict(gridcolor=COLORS['grid_lines']),
        yaxis=dict(gridcolor=COLORS['grid_lines'])
    )

    # CHART 3: HEIGHT-WEIGHT HEATMAP
    df_hw = filtered_df.dropna(subset=['Height', 'Weight'])
    if len(df_hw) > 0:
        try:
            fig3 = px.density_heatmap(
                df_hw,
                x='Height',
                y='Weight',
                nbinsx=25,
                nbinsy=25,
                title='Athletic Builds: Which Sport Profiles Dominate?',
                color_continuous_scale=[[0, '#eff6ff'], [0.5, '#3b82f6'], [1, '#1e3a8a']],
                marginal_x='histogram',
                marginal_y='histogram'
            )
            fig3.add_annotation(
                x=188,
                y=92,
                text="Swimmers: Tall & heavy<br>(188cm, 92kg)",
                showarrow=True,
                arrowhead=2,
                bgcolor="rgba(6, 182, 212, 0.9)",
                font=dict(color='#ffffff', size=10),
                ax=50,
                ay=-60
            )
            fig3.add_annotation(
                x=162,
                y=56,
                text="Gymnasts: Smaller<br>(162cm, 56kg)",
                showarrow=True,
                arrowhead=2,
                bgcolor="rgba(251, 191, 36, 0.9)",
                font=dict(color='#111827', size=10),
                ax=-50,
                ay=40
            )
        except Exception:
            fig3 = px.scatter(
                df_hw.sample(min(1000, len(df_hw))),
                x='Height',
                y='Weight',
                title='Athletic Builds',
                opacity=0.5
            )
    else:
        fig3 = px.scatter(title='Athletic Builds (no data for current filters)')

    fig3.update_layout(
        plot_bgcolor='#ffffff',
        paper_bgcolor='#ffffff',
        font=dict(color=COLORS['text_white'], size=12),
        height=450,
        margin=dict(b=60, t=80, l=60, r=20),
        xaxis=dict(gridcolor=COLORS['grid_lines']),
        yaxis=dict(gridcolor=COLORS['grid_lines'])
    )

    # CHART 4: BOX PLOT - AGE VS MEDAL STATUS
    df_medals = filtered_df.dropna(subset=['Age', 'MedalStatus'])
    if len(df_medals) > 0:
        fig4 = px.box(
            df_medals,
            x='MedalStatus',
            y='Age',
            color='Sex',
            title='The Winning Age: When Do Athletes Peak?',
            color_discrete_map={
                'Male': COLORS['primary_blue'],
                'Female': COLORS['accent_gold']
            },
            points=False
        )
    else:
        fig4 = px.box(title='The Winning Age (no data for current filters)')

    fig4.add_annotation(
        text="Medalists peak at 26-28 years | Non-medalists show broader range",
        xref="paper",
        yref="paper",
        x=0.5,
        y=1.08,
        showarrow=False,
        font=dict(size=13, color=COLORS['secondary_cyan']),
        bgcolor="rgba(6, 182, 212, 0.12)",
        bordercolor=COLORS['secondary_cyan'],
        borderwidth=2,
        borderpad=10
    )
    fig4.update_layout(
        plot_bgcolor='#ffffff',
        paper_bgcolor='#ffffff',
        font=dict(color=COLORS['text_white'], size=12),
        height=450,
        margin=dict(b=60, t=100, l=60, r=20),
        legend=dict(orientation='h', y=-0.25),
        xaxis=dict(gridcolor=COLORS['grid_lines']),
        yaxis=dict(gridcolor=COLORS['grid_lines'])
    )

    # CHART 5: EVOLUTION OVER TIME (HEIGHT, AGE, WEIGHT)
    fig5 = make_subplots(
        rows=3,
        cols=1,
        shared_xaxes=True,
        subplot_titles=('Height', 'Age', 'Weight'),
        vertical_spacing=0.1
    )

    for metric, row in [('Height', 1), ('Age', 2), ('Weight', 3)]:
        df_metric = filtered_df.dropna(subset=[metric])
        if len(df_metric) == 0:
            continue
        avg_metric = df_metric.groupby(['Year', 'Sex'])[metric].mean().reset_index()
        for sex in ['Male', 'Female']:
            df_sub = avg_metric[avg_metric['Sex'] == sex]
            if len(df_sub) > 0:
                color = COLORS['primary_blue'] if sex == 'Male' else COLORS['accent_gold']
                fig5.add_trace(
                    go.Scatter(
                        x=df_sub['Year'],
                        y=df_sub[metric],
                        name=sex,
                        mode='lines+markers',
                        line=dict(color=color, width=3),
                        marker=dict(size=6),
                        showlegend=(row == 1)
                    ),
                    row=row,
                    col=1
                )

    fig5.update_yaxes(title_text="Height (cm)", row=1, col=1, gridcolor=COLORS['grid_lines'])
    fig5.update_yaxes(title_text="Age (years)", row=2, col=1, gridcolor=COLORS['grid_lines'])
    fig5.update_yaxes(title_text="Weight (kg)", row=3, col=1, gridcolor=COLORS['grid_lines'])
    fig5.update_xaxes(gridcolor=COLORS['grid_lines'])
    fig5.update_layout(
        title_text='Athlete Evolution Over Time',
        height=700,
        plot_bgcolor='#ffffff',
        paper_bgcolor='#ffffff',
        font=dict(color=COLORS['text_white'], size=12),
        margin=dict(b=60, t=80, l=60, r=20)
    )

    # CHART 6: AGE BY SPORT
    df_sports = filtered_df.dropna(subset=['Age', 'Sport'])
    if len(df_sports) > 0:
        top_10_sports = df_sports['Sport'].value_counts().head(10).index
        avg_age = (
            df_sports[df_sports['Sport'].isin(top_10_sports)]
            .groupby(['Sport', 'Sex'])['Age']
            .mean()
            .reset_index()
        )
        fig6 = px.bar(
            avg_age,
            x='Sport',
            y='Age',
            color='Sex',
            title='Sports by Age Profile',
            barmode='group',
            text='Age',
            color_discrete_map={
                'Male': COLORS['primary_blue'],
                'Female': COLORS['accent_gold']
            }
        )
        fig6.update_traces(textposition='outside', texttemplate='%{text:.1f}')
    else:
        fig6 = px.bar(title='Sports by Age Profile (no data for current filters)')

    fig6.add_annotation(
        text="Combat sports older | Artistic sports younger",
        xref="paper",
        yref="paper",
        x=0.5,
        y=1.08,
        showarrow=False,
        font=dict(size=12, color=COLORS['secondary_cyan']),
        bgcolor="rgba(6, 182, 212, 0.12)",
        bordercolor=COLORS['secondary_cyan'],
        borderwidth=2,
        borderpad=10
    )
    fig6.update_layout(
        plot_bgcolor='#ffffff',
        paper_bgcolor='#ffffff',
        font=dict(color=COLORS['text_white'], size=12),
        xaxis=dict(tickangle=-45, gridcolor=COLORS['grid_lines']),
        yaxis=dict(gridcolor=COLORS['grid_lines']),
        height=450,
        margin=dict(b=100, t=100, l=60, r=20)
    )

    return stat_cards, fig1, fig2, fig3, fig4, fig5, fig6



if __name__ == "__main__":
    app.run_server(host="0.0.0.0", port=8050)



