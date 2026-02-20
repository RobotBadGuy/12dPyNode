'use client';

import { useState } from 'react';
import { Mail, MapPin, Calendar, Edit2, Save, X, Bell, Lock, Palette, Globe, CreditCard, Check, Crown, Zap, AlertCircle } from 'lucide-react';
import { ImageWithFallback } from './ui/ImageWithFallback';

interface ProfilePageProps {
    onNavigate: (page: string) => void;
}

export function ProfilePage({ onNavigate }: ProfilePageProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'settings' | 'billing'>('profile');
    const [showCancelModal, setShowCancelModal] = useState(false);

    const [profileData, setProfileData] = useState({
        name: 'Sarah Johnson',
        email: 'sarah.johnson@nodeflow.com',
        role: 'Senior Workflow Designer',
        location: 'San Francisco, CA',
        joinDate: 'January 2024',
        bio: 'Passionate about building efficient workflows and automating complex processes. 5+ years of experience in process automation and data integration.',
    });

    const stats = [
        { label: 'Workflows Created', value: '47' },
        { label: 'Nodes Configured', value: '1,234' },
        { label: 'Collaborators', value: '18' },
        { label: 'Hours Saved', value: '320' },
    ];

    const recentActivity = [
        { action: 'Created workflow', name: 'Customer Onboarding Flow', time: '2 hours ago' },
        { action: 'Updated node', name: 'Data Validation Pipeline', time: '5 hours ago' },
        { action: 'Shared workflow', name: 'Invoice Processing System', time: '1 day ago' },
        { action: 'Configured mapping', name: 'Excel to Database Sync', time: '2 days ago' },
    ];

    const handleSave = () => {
        setIsEditing(false);
        // Save logic would go here
    };

    const plans = [
        {
            name: 'Starter',
            price: '$0',
            period: 'forever',
            features: ['5 workflows', 'Basic nodes', 'Community support', '100 executions/month'],
            color: 'slate',
            current: false,
        },
        {
            name: 'Professional',
            price: '$29',
            period: 'per month',
            features: ['Unlimited workflows', 'Advanced nodes', 'Priority support', '10,000 executions/month', 'Team collaboration', 'Custom integrations'],
            color: 'blue',
            current: true,
        },
        {
            name: 'Enterprise',
            price: '$99',
            period: 'per month',
            features: ['Everything in Pro', 'Dedicated support', 'Unlimited executions', 'Advanced security', 'SSO authentication', 'Custom SLA'],
            color: 'purple',
            current: false,
        },
    ];

    return (
        <div className="min-h-screen w-full pt-24 pb-12 px-6">
            <div className="max-w-6xl mx-auto">
                {/* Profile Header */}
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden mb-6">
                    {/* Cover Image */}
                    <div className="h-32 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-blue-600/20 relative">
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
                    </div>

                    <div className="px-8 pb-8">
                        <div className="flex items-start gap-6 -mt-16 relative">
                            {/* Profile Picture */}
                            <div className="relative">
                                <ImageWithFallback
                                    src="https://images.unsplash.com/photo-1655249493799-9cee4fe983bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBidXNpbmVzcyUyMHBlcnNvbiUyMGhlYWRzaG90fGVufDF8fHx8MTc3MDM4MTk2MXww&ixlib=rb-4.1.0&q=80&w=1080"
                                    alt={profileData.name}
                                    className="w-32 h-32 rounded-xl border-4 border-slate-800 object-cover"
                                />
                                <button className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-colors shadow-lg">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Profile Info */}
                            <div className="flex-1 pt-20">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h1 className="text-3xl font-bold text-white mb-1">{profileData.name}</h1>
                                        <p className="text-lg text-blue-400 mb-3">{profileData.role}</p>
                                        <div className="flex items-center gap-4 text-sm text-slate-400">
                                            <div className="flex items-center gap-1">
                                                <Mail className="w-4 h-4" />
                                                <span>{profileData.email}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <MapPin className="w-4 h-4" />
                                                <span>{profileData.location}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                <span>Joined {profileData.joinDate}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {!isEditing ? (
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-white transition-colors border border-slate-600"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                            Edit Profile
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleSave}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                                            >
                                                <Save className="w-4 h-4" />
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setIsEditing(false)}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-white transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-4 gap-4 mt-8">
                            {stats.map((stat) => (
                                <div key={stat.label} className="bg-slate-900/50 rounded-lg p-4 text-center border border-slate-700/30">
                                    <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                                    <div className="text-xs text-slate-400">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'profile'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800/30 text-slate-400 hover:text-white border border-slate-700/50'
                            }`}
                    >
                        Profile
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800/30 text-slate-400 hover:text-white border border-slate-700/50'
                            }`}
                    >
                        Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('billing')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'billing'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800/30 text-slate-400 hover:text-white border border-slate-700/50'
                            }`}
                    >
                        Billing
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'profile' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* About */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                                <h2 className="text-xl font-semibold text-white mb-4">About</h2>
                                {isEditing ? (
                                    <textarea
                                        value={profileData.bio}
                                        onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                                        className="w-full h-32 px-4 py-3 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-300 resize-none focus:outline-none focus:border-blue-500"
                                    />
                                ) : (
                                    <p className="text-slate-400">{profileData.bio}</p>
                                )}
                            </div>

                            {/* Recent Activity */}
                            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                                <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
                                <div className="space-y-4">
                                    {recentActivity.map((activity, index) => (
                                        <div key={index} className="flex items-start gap-3 pb-4 border-b border-slate-700/30 last:border-0 last:pb-0">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                                            <div className="flex-1">
                                                <div className="text-slate-300">
                                                    <span className="text-slate-500">{activity.action}</span>{' '}
                                                    <span className="font-medium text-white">{activity.name}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">{activity.time}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Skills */}
                            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                                <h2 className="text-xl font-semibold text-white mb-4">Skills</h2>
                                <div className="flex flex-wrap gap-2">
                                    {['Workflow Design', 'Data Mapping', 'API Integration', 'Process Automation', 'Node.js', 'Python'].map((skill) => (
                                        <span key={skill} className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Teams */}
                            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                                <h2 className="text-xl font-semibold text-white mb-4">Teams</h2>
                                <div className="space-y-3">
                                    {['Engineering', 'Product', 'Operations'].map((team) => (
                                        <div key={team} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                                                {team[0]}
                                            </div>
                                            <span className="text-slate-300">{team}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'billing' ? (
                    /* Billing Tab */
                    <div className="space-y-6">
                        {/* Current Plan */}
                        <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <Crown className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Current Plan</h2>
                                    <p className="text-sm text-slate-400">You are subscribed to the Professional plan</p>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-xl p-6 border border-blue-500/30">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="text-2xl font-bold text-white">Professional</h3>
                                            <span className="px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium">ACTIVE</span>
                                        </div>
                                        <div className="text-3xl font-bold text-white mb-1">
                                            $29<span className="text-lg text-slate-400 font-normal">/month</span>
                                        </div>
                                        <p className="text-sm text-slate-400">Next billing date: March 7, 2026</p>
                                    </div>
                                    <Zap className="w-8 h-8 text-blue-400" />
                                </div>

                                <div className="space-y-2 mb-6">
                                    {['Unlimited workflows', 'Advanced nodes', 'Priority support', '10,000 executions/month', 'Team collaboration', 'Custom integrations'].map((feature) => (
                                        <div key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                                            <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                                            <span>{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center gap-3">
                                    <button className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors">
                                        Upgrade to Enterprise
                                    </button>
                                    <button
                                        onClick={() => setShowCancelModal(true)}
                                        className="px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-300 font-medium transition-colors border border-slate-600"
                                    >
                                        Cancel Plan
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Available Plans */}
                        <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                            <h2 className="text-xl font-semibold text-white mb-4">Available Plans</h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {plans.map((plan) => {
                                    const isCurrentPlan = plan.current;
                                    const bgColor = plan.color === 'blue' ? 'from-blue-900/20 to-blue-900/10' :
                                        plan.color === 'purple' ? 'from-purple-900/20 to-purple-900/10' :
                                            'from-slate-900/20 to-slate-900/10';
                                    const borderColor = plan.color === 'blue' ? 'border-blue-500/30' :
                                        plan.color === 'purple' ? 'border-purple-500/30' :
                                            'border-slate-700/30';

                                    return (
                                        <div
                                            key={plan.name}
                                            className={`bg-gradient-to-br ${bgColor} rounded-lg p-5 border ${borderColor} ${isCurrentPlan ? 'ring-2 ring-blue-500/50' : ''}`}
                                        >
                                            <div className="text-center mb-4">
                                                <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                                                <div className="text-2xl font-bold text-white">
                                                    {plan.price}
                                                    <span className="text-sm text-slate-400 font-normal">/{plan.period}</span>
                                                </div>
                                            </div>

                                            <div className="space-y-2 mb-4">
                                                {plan.features.map((feature, idx) => (
                                                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                                                        <Check className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                                                        <span>{feature}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {isCurrentPlan ? (
                                                <button disabled className="w-full px-4 py-2 rounded-lg bg-blue-600/50 text-white font-medium cursor-not-allowed">
                                                    Current Plan
                                                </button>
                                            ) : (
                                                <button className="w-full px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-white font-medium transition-colors border border-slate-600">
                                                    {plan.price === '$0' ? 'Downgrade' : 'Upgrade'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Payment Method & Billing History */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Payment Method */}
                            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                        <CreditCard className="w-5 h-5 text-green-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-white">Payment Method</h2>
                                        <p className="text-sm text-slate-400">Manage your payment details</p>
                                    </div>
                                </div>

                                <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30 mb-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-8 rounded bg-gradient-to-r from-blue-600 to-blue-400 flex items-center justify-center text-white text-xs font-bold">
                                                VISA
                                            </div>
                                            <div>
                                                <div className="text-sm text-white font-medium">•••• •••• •••• 1234</div>
                                                <div className="text-xs text-slate-500">Expires 12/25</div>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="w-full px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-white text-sm font-medium transition-colors border border-slate-600">
                                        Update Card
                                    </button>
                                </div>

                                <button className="w-full px-4 py-2 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-sm font-medium transition-colors border border-blue-500/30">
                                    + Add New Payment Method
                                </button>
                            </div>

                            {/* Billing History */}
                            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                                <h2 className="text-lg font-semibold text-white mb-4">Billing History</h2>
                                <div className="space-y-3">
                                    {[
                                        { date: 'Feb 7, 2026', amount: '$29.00', status: 'Paid' },
                                        { date: 'Jan 7, 2026', amount: '$29.00', status: 'Paid' },
                                        { date: 'Dec 7, 2025', amount: '$29.00', status: 'Paid' },
                                    ].map((invoice, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                                            <div>
                                                <div className="text-sm text-white font-medium">{invoice.amount}</div>
                                                <div className="text-xs text-slate-500">{invoice.date}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/30">
                                                    {invoice.status}
                                                </span>
                                                <button className="text-blue-400 hover:text-blue-300 text-xs">
                                                    Download
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Settings Tab */
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Notifications */}
                        <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                    <Bell className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Notifications</h2>
                                    <p className="text-sm text-slate-400">Manage your notification preferences</p>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {['Email notifications', 'Push notifications', 'Workflow updates', 'Team mentions'].map((setting) => (
                                    <div key={setting} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/30">
                                        <span className="text-slate-300">{setting}</span>
                                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Security */}
                        <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                                    <Lock className="w-5 h-5 text-green-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Security</h2>
                                    <p className="text-sm text-slate-400">Manage your security settings</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <button className="w-full text-left p-3 rounded-lg bg-slate-900/50 border border-slate-700/30 hover:bg-slate-700/30 transition-colors">
                                    <div className="text-slate-300">Change password</div>
                                    <div className="text-xs text-slate-500 mt-1">Last changed 3 months ago</div>
                                </button>
                                <button className="w-full text-left p-3 rounded-lg bg-slate-900/50 border border-slate-700/30 hover:bg-slate-700/30 transition-colors">
                                    <div className="text-slate-300">Two-factor authentication</div>
                                    <div className="text-xs text-slate-500 mt-1">Add an extra layer of security</div>
                                </button>
                            </div>
                        </div>

                        {/* Appearance */}
                        <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                    <Palette className="w-5 h-5 text-purple-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Appearance</h2>
                                    <p className="text-sm text-slate-400">Customize your interface</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <button className="p-4 rounded-lg bg-slate-900 border-2 border-blue-500 transition-colors">
                                        <div className="w-full h-12 rounded bg-gradient-to-br from-slate-800 to-slate-900 mb-2" />
                                        <div className="text-sm text-white text-center">Dark</div>
                                    </button>
                                    <button className="p-4 rounded-lg bg-white border-2 border-slate-700/30 hover:border-slate-600 transition-colors">
                                        <div className="w-full h-12 rounded bg-gradient-to-br from-gray-50 to-gray-100 mb-2" />
                                        <div className="text-sm text-slate-900 text-center">Light</div>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Language & Region */}
                        <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                                    <Globe className="w-5 h-5 text-yellow-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Language & Region</h2>
                                    <p className="text-sm text-slate-400">Set your language and timezone</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-sm text-slate-400 block mb-2">Language</label>
                                    <select className="w-full px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-300 focus:outline-none focus:border-blue-500">
                                        <option>English (US)</option>
                                        <option>Spanish</option>
                                        <option>French</option>
                                        <option>German</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-slate-400 block mb-2">Timezone</label>
                                    <select className="w-full px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-700 text-slate-300 focus:outline-none focus:border-blue-500">
                                        <option>Pacific Time (PT)</option>
                                        <option>Eastern Time (ET)</option>
                                        <option>Central European Time (CET)</option>
                                        <option>GMT</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Cancel Subscription Modal */}
            {showCancelModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50 w-96">
                        <h2 className="text-xl font-semibold text-white mb-4">Cancel Subscription</h2>
                        <p className="text-sm text-slate-400 mb-4">Are you sure you want to cancel your subscription? This action cannot be undone.</p>
                        <div className="flex items-center justify-end gap-4">
                            <button
                                onClick={() => setShowCancelModal(false)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                                Cancel
                            </button>
                            <button
                                onClick={() => setShowCancelModal(false)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
                            >
                                <AlertCircle className="w-4 h-4" />
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
