'use client';

import { Zap, Shield, Layers, ArrowRight, CheckCircle2, Users, TrendingUp } from 'lucide-react';

interface LandingPageProps {
    onNavigate: (page: string) => void;
}

export function LandingPage({ onNavigate }: LandingPageProps) {
    const features = [
        {
            icon: Zap,
            title: 'Lightning Fast',
            description: 'Build complex workflows in minutes with our intuitive drag-and-drop interface.',
            color: 'text-yellow-400',
            bgColor: 'bg-yellow-400/10',
        },
        {
            icon: Shield,
            title: 'Secure & Reliable',
            description: 'Enterprise-grade security with 99.9% uptime guarantee for your critical workflows.',
            color: 'text-green-400',
            bgColor: 'bg-green-400/10',
        },
        {
            icon: Layers,
            title: 'Powerful Integration',
            description: 'Connect with hundreds of tools and services to automate your entire workflow.',
            color: 'text-purple-400',
            bgColor: 'bg-purple-400/10',
        },
    ];

    const stats = [
        { label: 'Active Users', value: '50K+', icon: Users },
        { label: 'Workflows Created', value: '2M+', icon: Layers },
        { label: 'Time Saved', value: '10M hrs', icon: TrendingUp },
    ];

    const benefits = [
        'Visual workflow builder with drag-and-drop',
        'Real-time collaboration with your team',
        'Advanced data mapping and transformation',
        'Custom integrations and API access',
        'Automated testing and deployment',
        'Enterprise support and training',
    ];

    return (
        <div className="min-h-screen w-full">
            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center space-y-6">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm">
                            <Zap className="w-4 h-4" />
                            <span>Now with AI-powered automation</span>
                        </div>

                        <h1 className="text-6xl font-bold text-white leading-tight">
                            Build Powerful Workflows
                            <br />
                            <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                                Without Writing Code
                            </span>
                        </h1>

                        <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                            12d Pynode empowers teams to automate complex processes with our visual node-based editor.
                            Map data, transform information, and connect your tools seamlessly.
                        </p>

                        <div className="flex items-center justify-center gap-4 pt-4">
                            <button
                                onClick={() => onNavigate('editor')}
                                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-lg shadow-blue-500/25"
                            >
                                Get Started
                                <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => onNavigate('profile')}
                                className="px-6 py-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-white font-medium transition-colors border border-slate-700"
                            >
                                View Demo
                            </button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20">
                        {stats.map((stat) => {
                            const Icon = stat.icon;
                            return (
                                <div key={stat.label} className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 text-center">
                                    <Icon className="w-8 h-8 text-blue-400 mx-auto mb-3" />
                                    <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                                    <div className="text-sm text-slate-400">{stat.label}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold text-white mb-4">
                            Everything you need to automate
                        </h2>
                        <p className="text-lg text-slate-400">
                            Powerful features designed for modern teams
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {features.map((feature) => {
                            const Icon = feature.icon;
                            return (
                                <div
                                    key={feature.title}
                                    className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-8 border border-slate-700/50 hover:border-slate-600 transition-all group"
                                >
                                    <div className={`w-12 h-12 rounded-lg ${feature.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                        <Icon className={`w-6 h-6 ${feature.color}`} />
                                    </div>
                                    <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                                    <p className="text-slate-400">{feature.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Benefits Section */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-2xl p-12 border border-slate-700/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div>
                                <h2 className="text-3xl font-bold text-white mb-4">
                                    Why teams choose 12d Pynode
                                </h2>
                                <p className="text-slate-400 mb-8">
                                    Join thousands of teams who have transformed their workflows with our platform.
                                </p>
                                <button
                                    onClick={() => onNavigate('editor')}
                                    className="px-6 py-3 rounded-lg bg-white text-slate-900 font-medium hover:bg-slate-100 transition-colors"
                                >
                                    Start Building Free
                                </button>
                            </div>

                            <div className="space-y-3">
                                {benefits.map((benefit) => (
                                    <div key={benefit} className="flex items-start gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                                        <span className="text-slate-300">{benefit}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl font-bold text-white mb-4">
                        Ready to get started?
                    </h2>
                    <p className="text-lg text-slate-400 mb-8">
                        Join thousands of teams already using 12d Pynode to build better workflows.
                    </p>
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={() => onNavigate('editor')}
                            className="px-8 py-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors shadow-lg shadow-blue-500/25"
                        >
                            Start Free Trial
                        </button>
                        <button className="px-8 py-4 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-white font-medium transition-colors border border-slate-700">
                            Schedule Demo
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}
