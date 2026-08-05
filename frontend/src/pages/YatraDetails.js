import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import { yatraApi, expenseApi, ticketApi, registrationApi, reviewApi, getMediaUrl } from '../utils/api';
import { AuthContext } from '../context/AuthContext';
import ImageCropper from '../components/ImageCropper';
import { useContext } from 'react';

const YatraDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses', 'tickets', 'registrationsLog', 'requests', 'reviews'
  
  const [yatra, setYatra] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [registrationsLog, setRegistrationsLog] = useState([]);
  const [requests, setRequests] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [myRegStatus, setMyRegStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);
  const myExistingReview = reviews.find(r => r.user?._id === user?.id || r.user?._id === user?._id || r.user === user?.id || r.user === user?._id);

  // Modal states
  const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ name: '', amount: '', description: '' });
  const [isEditExpenseModalOpen, setEditExpenseModalOpen] = useState(false);
  const [editExpenseData, setEditExpenseData] = useState(null);

  const [isTicketModalOpen, setTicketModalOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({ name: '', from: '', to: '', paymentBy: '', ticketFile: null, ticketCancellationFile: null });
  const [isEditTicketModalOpen, setEditTicketModalOpen] = useState(false);
  const [editTicketData, setEditTicketData] = useState(null);

  const [isEnrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollData, setEnrollData] = useState({ paymentRefId: '', paymentScreenshot: null });

  const [isRegEditModalOpen, setRegEditModalOpen] = useState(false);
  const [editRegData, setEditRegData] = useState(null);

  const [selectedUser, setSelectedUser] = useState(null); // For User details modal
  const [isUserModalOpen, setUserModalOpen] = useState(false);

  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });

  const [isEditYatraModalOpen, setEditYatraModalOpen] = useState(false);
  const [editYatraData, setEditYatraData] = useState(null);
  const [myRegDetails, setMyRegDetails] = useState(null); // Full registration details for participant

  const [cropperImageSrc, setCropperImageSrc] = useState(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCropperImageSrc(ev.target.result);
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const yatraRes = await yatraApi.getById(id);
        if (yatraRes.data.success) setYatra(yatraRes.data.yatra);

        const reviewRes = await reviewApi.getAll(id).catch(e => null);
        if (reviewRes && reviewRes.data.success) {
          const list = reviewRes.data.reviews;
          setReviews(list);
          const existing = list.find(r => r.user?._id === user?.id || r.user?._id === user?._id || r.user === user?.id || r.user === user?._id);
          if (existing) {
            setNewReview({ rating: existing.rating, comment: existing.comment });
          }
        }

        const myStatusRes = await registrationApi.myStatus(id).catch(e => null);
        if (myStatusRes && myStatusRes.data.success && myStatusRes.data.registration) {
          const reg = myStatusRes.data.registration;
          setMyRegStatus(reg);
          setMyRegDetails(reg); // store full details for financial display
        }

        const isManagerOrAdmin = user?.role === 'Admin' || user?.role === 'Manager';
        
        if (isManagerOrAdmin) {
          const [expRes, tickRes, logRes, reqRes] = await Promise.all([
            expenseApi.getAll(id),
            ticketApi.getAll(id),
            registrationApi.getAll(id, { status: 'Approved' }),
            registrationApi.getAll(id, { status: 'Pending' })
          ]);

          if (expRes.data.success) setExpenses(expRes.data.expenses);
          if (tickRes.data.success) setTickets(tickRes.data.tickets);
          if (logRes.data.success) setRegistrationsLog(logRes.data.registrations);
          if (reqRes.data.success) setRequests(reqRes.data.registrations);
        }
      } catch (error) {
        console.error("Failed to fetch yatra details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, user]);

  /* --- Expense Handlers --- */
  const handleAddExpense = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...newExpense, yatraId: id };
      const res = await expenseApi.add(payload);
      if (res.data.success) {
        setExpenses([...expenses, res.data.expense]);
        setExpenseModalOpen(false);
        setNewExpense({ name: '', amount: '', description: '' });
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to add expense');
    }
  };

  const handleEditExpenseSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await expenseApi.update(editExpenseData._id, editExpenseData);
      if (res.data.success) {
        setExpenses(expenses.map(exp => exp._id === res.data.expense._id ? res.data.expense : exp));
        setEditExpenseModalOpen(false);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update expense');
    }
  };

  const handleDeleteExpense = async (expId) => {
    if(!window.confirm("Are you sure you want to delete this expense?")) return;
    try {
      await expenseApi.delete(expId);
      setExpenses(expenses.filter(exp => exp._id !== expId));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete expense');
    }
  };

  /* --- Ticket Handlers --- */
  const handleAddTicket = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('yatraId', id);
      formData.append('name', newTicket.name);
      formData.append('from', newTicket.from);
      formData.append('to', newTicket.to);
      formData.append('paymentBy', newTicket.paymentBy);
      if (newTicket.ticketFile) {
        formData.append('ticketFile', newTicket.ticketFile);
      }
      if (newTicket.ticketCancellationFile) {
        formData.append('ticketCancellationFile', newTicket.ticketCancellationFile);
      }

      const res = await ticketApi.add(formData); 
      if (res.data.success) {
        setTickets([...tickets, res.data.ticket]);
        setTicketModalOpen(false);
        setNewTicket({ name: '', from: '', to: '', paymentBy: '', ticketFile: null, ticketCancellationFile: null });
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to add ticket');
    }
  };

  const handleEditTicketSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', editTicketData.name);
      formData.append('from', editTicketData.from);
      formData.append('to', editTicketData.to);
      formData.append('paymentBy', editTicketData.paymentBy);
      if (editTicketData.newTicketFile) {
        formData.append('ticketFile', editTicketData.newTicketFile);
      }
      if (editTicketData.newTicketCancellationFile) {
        formData.append('ticketCancellationFile', editTicketData.newTicketCancellationFile);
      }

      const res = await ticketApi.update(editTicketData._id, formData);
      if (res.data.success) {
        setTickets(tickets.map(t => t._id === res.data.ticket._id ? res.data.ticket : t));
        setEditTicketModalOpen(false);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update ticket');
    }
  };

  const handleDeleteTicket = async (ticketId) => {
    if(!window.confirm("Are you sure you want to delete this ticket?")) return;
    try {
      await ticketApi.delete(ticketId);
      setTickets(tickets.filter(t => t._id !== ticketId));
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete ticket');
    }
  };

  /* --- Registration / Enrollment Handlers --- */
  const handleEnrollSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('yatraId', id);
      formData.append('paymentRefId', enrollData.paymentRefId);
      if (enrollData.paymentScreenshot) {
        formData.append('paymentScreenshot', enrollData.paymentScreenshot);
      }
      
      const res = await registrationApi.register(formData);
      if (res.data.success) {
        setMyRegStatus(res.data.registration);
        alert("Successfully registered for Yatra. Awaiting Manager approval.");
        setEnrollModalOpen(false);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to enroll');
    }
  };

  const handleApproveReg = async (reg) => {
    try {
      const res = await registrationApi.approve(reg._id, 'Approve');
      if (res.data.success) {
        setRequests(requests.filter(r => r._id !== reg._id));
        setRegistrationsLog([...registrationsLog, res.data.registration]);
      }
    } catch (error) {
      alert("Failed to approve registration");
    }
  };

  const handleRejectReg = async (reg) => {
    if(!window.confirm("Reject this registration request?")) return;
    try {
      const res = await registrationApi.approve(reg._id, 'Reject');
      if (res.data.success) {
        setRequests(requests.filter(r => r._id !== reg._id));
      }
    } catch (error) {
      alert("Failed to reject registration");
    }
  };

  const handleUpdateRegDetails = async (e) => {
    e.preventDefault();
    try {
      const res = await registrationApi.updateDetails(editRegData._id, editRegData);
      if (res.data.success) {
        setRegistrationsLog(registrationsLog.map(reg => reg._id === editRegData._id ? res.data.registration : reg));
        setRegEditModalOpen(false);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update registration details');
    }
  };

  /* --- Review Handler --- */
  const handleAddReview = async (e) => {
    e.preventDefault();
    try {
      const res = await reviewApi.add({ yatraId: id, ...newReview });
      if (res.data.success) {
        const populatedReview = { ...res.data.review, user: { _id: user.id || user._id, firstName: user.firstName, lastName: user.lastName } };
        setReviews([populatedReview, ...reviews]);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to add review');
    }
  };

  const handleUpdateReview = async (e) => {
    e.preventDefault();
    try {
      const res = await reviewApi.update(myExistingReview._id, { rating: newReview.rating, comment: newReview.comment });
      if (res.data.success) {
        setReviews(reviews.map(r => r._id === myExistingReview._id ? { ...res.data.review, user: myExistingReview.user } : r));
        alert("Review updated successfully!");
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update review');
    }
  };

  /* --- Yatra Edit/Delete Handlers --- */
  const handleEditYatraSubmit = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('title', editYatraData.title);
      formData.append('description', editYatraData.description);
      formData.append('destination', editYatraData.destination);
      formData.append('startDate', editYatraData.startDate);
      formData.append('endDate', editYatraData.endDate);
      formData.append('registrationFee', editYatraData.registrationFee);
      if (editYatraData.bankDetails) formData.append('bankDetails', editYatraData.bankDetails);
      if (editYatraData.upiId !== undefined) formData.append('upiId', editYatraData.upiId);
      if (editYatraData.newThumbnail) formData.append('thumbnail', editYatraData.newThumbnail);
      if (editYatraData.newQrCode) formData.append('qrCode', editYatraData.newQrCode);

      const res = await yatraApi.update(id, formData);
      if (res.data.success) {
        setYatra(res.data.yatra);
        setEditYatraModalOpen(false);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update yatra');
    }
  };

  const handleDeleteYatra = async () => {
    if (!window.confirm('Are you sure you want to delete this Yatra? This action cannot be undone.')) return;
    try {
      await yatraApi.delete(id);
      navigate('/');
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete yatra');
    }
  };

  if (loading) return <div style={{ padding: '24px', textAlign: 'center' }}>Loading details...</div>;
  if (!yatra) return <div style={{ padding: '24px', textAlign: 'center' }}>Yatra not found.</div>;

  const isManagerOrAdmin = user?.role === 'Admin' || user?.role === 'Manager';
  const userId = user?._id || user?.id;
  const isYatraOwner = (yatra?.createdBy?._id || yatra?.createdBy)?.toString() === userId?.toString();

  return (
    <>
      <div className="animate-fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '24px' }}>
          {yatra.thumbnail && (
            <img src={getMediaUrl(yatra.thumbnail)} alt={yatra.title} style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '12px' }} />
          )}
          <div>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>{yatra.title}</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Destination: {yatra.destination} | Starts: {new Date(yatra.startDate).toLocaleDateString()} | Fee: ₹{yatra.registrationFee}</p>
            <p style={{ marginTop: '12px' }}>{yatra.description}</p>
          </div>
        </div>
        {(user?.role === 'Participant' || user?.role === 'Manager' || user?.role === 'Admin') && yatra.status !== 'Completed' && (
          myRegStatus ? (
            <div style={{ textAlign: 'right' }}>
              {myRegStatus.status === 'Pending' && (
                <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-warning)', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem' }}>
                  ⏳ Enrollment Pending Approval
                </span>
              )}
              {myRegStatus.status === 'Approved' && (
                <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem' }}>
                  ✅ Registered
                </span>
              )}
              {myRegStatus.status === 'Rejected' && (
                <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-danger)', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem' }}>
                  ❌ Enrollment Rejected
                </span>
              )}
            </div>
          ) : (
            <Button variant="primary" onClick={() => setEnrollModalOpen(true)} style={{ width: 'auto' }}>Enroll in Yatra</Button>
          )
        )}
      </div>

      {/* Participant financial summary when approved */}
      {user?.role === 'Participant' && myRegDetails?.status === 'Approved' && (
        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(99,102,241,0.07)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.2)' }}>
          <h3 style={{ marginBottom: '12px', fontSize: '1rem' }}>💳 My Payment Summary</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Amount</p>
              <p style={{ fontSize: '1.3rem', fontWeight: '700' }}>₹{myRegDetails.amountToBePaid || yatra.registrationFee}</p>
            </div>
            <div style={{ background: 'rgba(16,185,129,0.1)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Paid</p>
              <p style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--accent-success)' }}>₹{(myRegDetails.paidOnline || 0) + (myRegDetails.paidCash || 0)}</p>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Remaining</p>
              <p style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--accent-danger)' }}>₹{Math.max(0, (myRegDetails.amountToBePaid || yatra.registrationFee) - (myRegDetails.paidOnline || 0) - (myRegDetails.paidCash || 0))}</p>
            </div>
          </div>
        </div>
      )}

      {/* Edit / Delete Yatra buttons - only for the yatra's own manager or admin */}
      {isYatraOwner && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', padding: '16px', background: 'rgba(99,102,241,0.06)', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.2)', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', flex: 1 }}>You manage this Yatra</span>
          <Button
            variant="default"
            style={{ width: 'auto', padding: '8px 20px', border: '1px solid rgba(99,102,241,0.4)' }}
            onClick={() => {
              setEditYatraData({
                title: yatra.title,
                description: yatra.description,
                destination: yatra.destination,
                startDate: yatra.startDate?.slice(0, 10),
                endDate: yatra.endDate?.slice(0, 10),
                registrationFee: yatra.registrationFee,
                bankDetails: yatra.bankDetails || '',
                upiId: yatra.upiId || ''
              });
              setEditYatraModalOpen(true);
            }}
          >
            ✏️ Edit Yatra Details
          </Button>
          <Button
            variant="danger"
            style={{ width: 'auto', padding: '8px 20px' }}
            onClick={handleDeleteYatra}
          >
            🗑️ Delete Yatra
          </Button>
        </div>
      )}
      
      {yatra.gallery && yatra.gallery.length > 0 && (
        <div style={{ marginBottom: '32px', display: 'flex', gap: '12px', overflowX: 'auto' }}>
          {yatra.gallery.map((img, i) => (
            <img key={i} src={getMediaUrl(img)} alt="Gallery" style={{ height: '100px', borderRadius: '8px', objectFit: 'cover' }} />
          ))}
        </div>
      )}

      {isManagerOrAdmin ? (
        <>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <Button variant={activeTab === 'expenses' ? 'primary' : 'default'} onClick={() => setActiveTab('expenses')} style={{ width: 'auto' }}>Expenses</Button>
            <Button variant={activeTab === 'tickets' ? 'primary' : 'default'} onClick={() => setActiveTab('tickets')} style={{ width: 'auto' }}>Tickets</Button>
            <Button variant={activeTab === 'registrationsLog' ? 'primary' : 'default'} onClick={() => setActiveTab('registrationsLog')} style={{ width: 'auto' }}>Registrations Log</Button>
            <Button variant={activeTab === 'requests' ? 'primary' : 'default'} onClick={() => setActiveTab('requests')} style={{ width: 'auto' }}>Requests</Button>
            <Button variant={activeTab === 'reviews' ? 'primary' : 'default'} onClick={() => setActiveTab('reviews')} style={{ width: 'auto' }}>Reviews</Button>
          </div>

          <Card>
            {activeTab === 'expenses' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2>Expenses</h2>
                  {(isYatraOwner || user?.role === 'Admin') && <Button style={{ width: 'auto' }} onClick={() => setExpenseModalOpen(true)}>+ Add Expense</Button>}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Name</th>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Description</th>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Amount</th>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map(exp => (
                      <tr key={exp._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px' }}>{exp.name}</td>
                        <td style={{ padding: '12px' }}>{exp.description}</td>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>₹{exp.amount}</td>
                        <td style={{ padding: '12px' }}>
                          {(isYatraOwner || user?.role === 'Admin') && (
                            <>
                              <Button variant="default" style={{ padding: '4px 8px', fontSize: '0.8rem', marginRight: '8px' }} onClick={() => { setEditExpenseData(exp); setEditExpenseModalOpen(true); }}>Edit</Button>
                              <Button variant="danger" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleDeleteExpense(exp._id)}>Delete</Button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'tickets' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2>Tickets</h2>
                  {(isYatraOwner || user?.role === 'Admin') && <Button style={{ width: 'auto' }} onClick={() => setTicketModalOpen(true)}>+ Add Ticket</Button>}
                </div>
                
                {tickets.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Name</th>
                        <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>From - To</th>
                        <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Payment By</th>
                        <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Files</th>
                        <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map(ticket => (
                        <tr key={ticket._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px' }}>{ticket.name}</td>
                          <td style={{ padding: '12px' }}>{ticket.from} ➔ {ticket.to}</td>
                          <td style={{ padding: '12px' }}>{ticket.paymentBy}</td>
                          <td style={{ padding: '12px' }}>
                            {ticket.ticketFile && <a href={getMediaUrl(ticket.ticketFile)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', marginRight: '12px' }}>Ticket 📎</a>}
                            {ticket.ticketCancellationFile && <a href={getMediaUrl(ticket.ticketCancellationFile)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-warning)' }}>Cancel File 📎</a>}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {(isYatraOwner || user?.role === 'Admin') && (
                              <>
                                <Button variant="default" style={{ padding: '4px 8px', fontSize: '0.8rem', marginRight: '8px' }} onClick={() => { setEditTicketData(ticket); setEditTicketModalOpen(true); }}>Edit</Button>
                                <Button variant="danger" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleDeleteTicket(ticket._id)}>Delete</Button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: 'var(--text-secondary)' }}>No tickets added yet.</p>
                )}
              </div>
            )}

            {activeTab === 'registrationsLog' && (
              <div>
                <h2 style={{ marginBottom: '16px' }}>Registrations Log</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Participant</th>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Amount to be paid</th>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Paid Online</th>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Paid Cash</th>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Left to be paid</th>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrationsLog.map(reg => {
                      const left = (reg.amountToBePaid || 0) - (reg.paidOnline || 0) - (reg.paidCash || 0);
                      return (
                      <tr key={reg._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', color: 'var(--accent-primary)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { setSelectedUser(reg.user); setUserModalOpen(true); }}>
                          {reg.user.firstName} {reg.user.lastName}
                        </td>
                        <td style={{ padding: '12px' }}>₹{reg.amountToBePaid || 0}</td>
                        <td style={{ padding: '12px', color: 'var(--accent-success)' }}>₹{reg.paidOnline || 0}</td>
                        <td style={{ padding: '12px', color: 'var(--accent-success)' }}>₹{reg.paidCash || 0}</td>
                        <td style={{ padding: '12px', color: left > 0 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>₹{left}</td>
                        <td style={{ padding: '12px' }}>
                          {(isYatraOwner || user?.role === 'Admin') && (
                            <Button variant="default" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => { setEditRegData(reg); setRegEditModalOpen(true); }}>Edit Details</Button>
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'requests' && (
              <div>
                <h2 style={{ marginBottom: '16px' }}>Enrollment Requests</h2>
                {requests.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {requests.map(reg => (
                      <Card key={reg._id} style={{ padding: '16px' }}>
                        <p><strong>Participant:</strong> <span style={{ cursor: 'pointer', color: 'var(--accent-primary)', textDecoration: 'underline'}} onClick={() => { setSelectedUser(reg.user); setUserModalOpen(true); }}>{reg.user.firstName} {reg.user.lastName}</span></p>
                        <p><strong>Ref ID:</strong> {reg.paymentRefId}</p>
                        {reg.paymentScreenshot && (
                          <div style={{ margin: '12px 0' }}>
                            <a href={getMediaUrl(reg.paymentScreenshot)} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                              <img src={getMediaUrl(reg.paymentScreenshot)} alt="Screenshot" style={{ width: '100%', borderRadius: '8px', cursor: 'pointer', border: '2px solid transparent', transition: 'border 0.2s' }} onMouseOver={e => e.target.style.border = '2px solid var(--accent-primary)'} onMouseOut={e => e.target.style.border = '2px solid transparent'} />
                              <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: '4px', textAlign: 'center' }}>📎 Click to open full screenshot</p>
                            </a>
                          </div>
                        )}
                        {(isYatraOwner || user?.role === 'Admin') && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                            <Button variant="primary" onClick={() => handleApproveReg(reg)} style={{ flex: 1 }}>Approve</Button>
                            <Button variant="danger" onClick={() => handleRejectReg(reg)} style={{ flex: 1 }}>Reject</Button>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p>No pending requests.</p>
                )}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div>
                <h2 style={{ marginBottom: '16px' }}>Yatra Reviews</h2>
                {reviews.length > 0 ? (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {reviews.map(rev => (
                      <Card key={rev._id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <strong>{rev.user.firstName} {rev.user.lastName}</strong>
                          <span style={{ color: 'var(--accent-warning)' }}>{'★'.repeat(rev.rating)}</span>
                        </div>
                        <p>{rev.comment}</p>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p>No reviews yet.</p>
                )}
              </div>
            )}
          </Card>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <Button variant={activeTab === 'reviews' ? 'primary' : 'default'} onClick={() => setActiveTab('reviews')} style={{ width: 'auto' }}>Reviews</Button>
          </div>
          
          <Card>
            {activeTab === 'reviews' && (
              <div>
                <h2 style={{ marginBottom: '16px' }}>Yatra Reviews</h2>
                
                {/* Participant can add review ONLY if yatra is Completed and they're approved */}
                {yatra.status?.toLowerCase() === 'completed' && myRegStatus?.status === 'Approved' && (
                  <form onSubmit={myExistingReview ? handleUpdateReview : handleAddReview} style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                    <h3 style={{ marginBottom: '12px' }}>{myExistingReview ? 'Edit Your Review' : 'Leave a Review'}</h3>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '4px' }}>Rating (1-5)</label>
                      <input type="number" min="1" max="5" className="input-field" value={newReview.rating} onChange={e => setNewReview({...newReview, rating: Number(e.target.value)})} required />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '4px' }}>Comment</label>
                      <textarea className="input-field" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})} required />
                    </div>
                    <Button type="submit">{myExistingReview ? 'Update Review' : 'Submit Review'}</Button>
                  </form>
                )}

                {reviews.length > 0 ? (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {reviews.map(rev => (
                      <Card key={rev._id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <strong>{rev.user.firstName} {rev.user.lastName}</strong>
                          <span style={{ color: 'var(--accent-warning)' }}>{'★'.repeat(rev.rating)}</span>
                        </div>
                        <p>{rev.comment}</p>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p>No reviews yet.</p>
                )}
              </div>
            )}
          </Card>
        </>
      )}
      </div>

      {/* Expense Modals */}
      {isExpenseModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '16px' }}>Add New Expense</h2>
            <form onSubmit={handleAddExpense}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Expense Name</label>
                <input type="text" className="input-field" value={newExpense.name} onChange={e => setNewExpense({...newExpense, name: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Amount (₹)</label>
                <input type="number" className="input-field" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Description</label>
                <input type="text" className="input-field" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="default" onClick={() => setExpenseModalOpen(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>Cancel</Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>Save Expense</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditExpenseModalOpen && editExpenseData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '16px' }}>Edit Expense</h2>
            <form onSubmit={handleEditExpenseSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Expense Name</label>
                <input type="text" className="input-field" value={editExpenseData.name} onChange={e => setEditExpenseData({...editExpenseData, name: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Amount (₹)</label>
                <input type="number" className="input-field" value={editExpenseData.amount} onChange={e => setEditExpenseData({...editExpenseData, amount: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Description</label>
                <input type="text" className="input-field" value={editExpenseData.description} onChange={e => setEditExpenseData({...editExpenseData, description: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="default" onClick={() => setEditExpenseModalOpen(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>Cancel</Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Modal */}
      {isTicketModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '16px' }}>Add Ticket</h2>
            <form onSubmit={handleAddTicket}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Name (who booked)</label>
                <input type="text" className="input-field" value={newTicket.name} onChange={e => setNewTicket({...newTicket, name: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>From</label>
                  <input type="text" className="input-field" value={newTicket.from} onChange={e => setNewTicket({...newTicket, from: e.target.value})} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>To</label>
                  <input type="text" className="input-field" value={newTicket.to} onChange={e => setNewTicket({...newTicket, to: e.target.value})} required />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Payment By (name of person)</label>
                <input type="text" className="input-field" value={newTicket.paymentBy} onChange={e => setNewTicket({...newTicket, paymentBy: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Ticket File</label>
                <input type="file" className="input-field" onChange={e => setNewTicket({...newTicket, ticketFile: e.target.files[0]})} required />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Ticket Cancellation File (optional)</label>
                <input type="file" className="input-field" onChange={e => setNewTicket({...newTicket, ticketCancellationFile: e.target.files[0]})} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="default" onClick={() => setTicketModalOpen(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>Cancel</Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>Save Ticket</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Ticket Modal */}
      {isEditTicketModalOpen && editTicketData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '16px' }}>Edit Ticket</h2>
            <form onSubmit={handleEditTicketSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Name (who booked)</label>
                <input type="text" className="input-field" value={editTicketData.name} onChange={e => setEditTicketData({...editTicketData, name: e.target.value})} required />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>From</label>
                  <input type="text" className="input-field" value={editTicketData.from} onChange={e => setEditTicketData({...editTicketData, from: e.target.value})} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>To</label>
                  <input type="text" className="input-field" value={editTicketData.to} onChange={e => setEditTicketData({...editTicketData, to: e.target.value})} required />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Payment By (name of person)</label>
                <input type="text" className="input-field" value={editTicketData.paymentBy} onChange={e => setEditTicketData({...editTicketData, paymentBy: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Update Ticket File (optional)</label>
                <input type="file" className="input-field" onChange={e => setEditTicketData({...editTicketData, newTicketFile: e.target.files[0]})} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Update Cancellation File (optional)</label>
                <input type="file" className="input-field" onChange={e => setEditTicketData({...editTicketData, newTicketCancellationFile: e.target.files[0]})} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="default" onClick={() => setEditTicketModalOpen(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>Cancel</Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Registration Details Modal */}
      {isRegEditModalOpen && editRegData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '500px', background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '16px' }}>Edit Registration Details</h2>
            <form onSubmit={handleUpdateRegDetails}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>First Name</label>
                  <input type="text" className="input-field" value={editRegData.firstName || editRegData.user.firstName} onChange={e => setEditRegData({...editRegData, firstName: e.target.value})} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Last Name</label>
                  <input type="text" className="input-field" value={editRegData.lastName || editRegData.user.lastName} onChange={e => setEditRegData({...editRegData, lastName: e.target.value})} required />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Amount To Be Paid (₹)</label>
                <input type="number" className="input-field" value={editRegData.amountToBePaid || 0} onChange={e => setEditRegData({...editRegData, amountToBePaid: Number(e.target.value)})} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Paid Online (₹)</label>
                <input type="number" className="input-field" value={editRegData.paidOnline || 0} onChange={e => setEditRegData({...editRegData, paidOnline: Number(e.target.value)})} required />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Paid Cash (₹)</label>
                <input type="number" className="input-field" value={editRegData.paidCash || 0} onChange={e => setEditRegData({...editRegData, paidCash: Number(e.target.value)})} required />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="default" onClick={() => setRegEditModalOpen(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>Cancel</Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {isUserModalOpen && selectedUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '16px' }}>User Details</h2>
            <div style={{ marginBottom: '24px' }}>
              <p><strong>Name:</strong> {selectedUser.firstName} {selectedUser.lastName}</p>
              <p><strong>Email:</strong> {selectedUser.email}</p>
              {selectedUser.phone && <p><strong>Phone:</strong> {selectedUser.phone}</p>}
              {selectedUser.phoneNumber && <p><strong>Phone:</strong> {selectedUser.phoneNumber}</p>}
              {selectedUser.gender && <p><strong>Gender:</strong> {selectedUser.gender}</p>}
              {selectedUser.aadharNumber && <p><strong>Aadhar:</strong> {selectedUser.aadharNumber}</p>}
              {selectedUser.centre && <p><strong>Centre:</strong> {selectedUser.centre}</p>}
              {selectedUser.role && <p><strong>Role:</strong> {selectedUser.role}</p>}
              {selectedUser.verificationStatus && <p><strong>Verification:</strong> {selectedUser.verificationStatus}</p>}
              {selectedUser.status && <p><strong>Status:</strong> {selectedUser.status}</p>}
            </div>
            <Button variant="default" onClick={() => setUserModalOpen(false)} style={{ width: '100%', background: 'rgba(255,255,255,0.1)' }}>Close</Button>
          </div>
        </div>
      )}

       {/* Enroll Modal */}
       {isEnrollModalOpen && (
         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', zIndex: 1000, backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '40px 20px' }}>
           <div className="animate-fade-in" style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', margin: 'auto' }}>
             <h2 style={{ marginBottom: '16px' }}>Enroll in Yatra</h2>

            {/* Payment Info Section */}
            <div style={{ marginBottom: '20px', background: 'rgba(99,102,241,0.1)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p style={{ fontWeight: '600', marginBottom: '12px', fontSize: '1rem' }}>💳 Payment Details</p>
              <p style={{ margin: '0 0 8px' }}><strong>Registration Fee:</strong> ₹{yatra.registrationFee}</p>
              {yatra.bankDetails && <p style={{ margin: '0 0 8px' }}><strong>Bank Details:</strong> {yatra.bankDetails}</p>}
              {yatra.upiId && (
                <div style={{ margin: '8px 0', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}><strong>UPI ID:</strong> <span style={{ color: 'var(--accent-primary)', fontFamily: 'monospace', fontSize: '1rem', userSelect: 'all' }}>{yatra.upiId}</span></p>
                </div>
              )}
              {yatra.qrCode && (
                <div style={{ margin: '12px 0', textAlign: 'center' }}>
                  <p style={{ marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Scan QR Code to pay:</p>
                  <img src={getMediaUrl(yatra.qrCode)} alt="Payment QR Code" style={{ maxWidth: '220px', borderRadius: '8px', border: '2px solid rgba(255,255,255,0.1)' }} />
                </div>
              )}
            </div>
            
            <form onSubmit={handleEnrollSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Payment Reference ID (Txn ID)</label>
                <input type="text" className="input-field" value={enrollData.paymentRefId} onChange={e => setEnrollData({...enrollData, paymentRefId: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Payment Screenshot</label>
                <input type="file" accept="image/*" className="input-field" onChange={e => setEnrollData({...enrollData, paymentScreenshot: e.target.files[0]})} required />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="default" onClick={() => setEnrollModalOpen(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>Cancel</Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>Submit Enrollment</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Yatra Modal */}
      {isEditYatraModalOpen && editYatraData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div className="animate-fade-in" style={{ width: '100%', maxWidth: '560px', background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '16px' }}>Edit Yatra Details</h2>
            <form onSubmit={handleEditYatraSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Title</label>
                <input type="text" className="input-field" value={editYatraData.title} onChange={e => setEditYatraData({...editYatraData, title: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Destination</label>
                <input type="text" className="input-field" value={editYatraData.destination} onChange={e => setEditYatraData({...editYatraData, destination: e.target.value})} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Description</label>
                <textarea className="input-field" value={editYatraData.description} onChange={e => setEditYatraData({...editYatraData, description: e.target.value})} rows={3} required />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Start Date</label>
                  <input type="date" className="input-field" value={editYatraData.startDate} onChange={e => setEditYatraData({...editYatraData, startDate: e.target.value})} required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>End Date</label>
                  <input type="date" className="input-field" value={editYatraData.endDate} onChange={e => setEditYatraData({...editYatraData, endDate: e.target.value})} required />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Registration Fee (₹)</label>
                <input type="number" className="input-field" value={editYatraData.registrationFee} onChange={e => setEditYatraData({...editYatraData, registrationFee: Number(e.target.value)})} required />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Bank Details / Payment Info</label>
                <textarea className="input-field" value={editYatraData.bankDetails} onChange={e => setEditYatraData({...editYatraData, bankDetails: e.target.value})} rows={2} />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>UPI ID (optional)</label>
                <input type="text" className="input-field" value={editYatraData.upiId || ''} onChange={e => setEditYatraData({...editYatraData, upiId: e.target.value})} />
              </div>
              {cropperImageSrc ? (
                <div style={{ marginBottom: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                  <p style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>Crop your thumbnail image:</p>
                  <ImageCropper
                    imageSrc={cropperImageSrc}
                    onCrop={(blob) => {
                      setEditYatraData({...editYatraData, newThumbnail: blob});
                      setCropperImageSrc(null);
                    }}
                    onCancel={() => setCropperImageSrc(null)}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Update Thumbnail (optional)</label>
                  {editYatraData.newThumbnail && <p style={{ fontSize: '0.85rem', color: 'var(--accent-success)', marginBottom: '4px' }}>✅ Thumbnail selected and cropped successfully</p>}
                  <input type="file" accept="image/*" className="input-field" onChange={handleFileSelect} />
                </div>
              )}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Update QR Code (optional)</label>
                <input type="file" accept="image/*" className="input-field" onChange={e => setEditYatraData({...editYatraData, newQrCode: e.target.files[0]})} />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button variant="default" onClick={() => setEditYatraModalOpen(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.1)' }}>Cancel</Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>Save Changes</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default YatraDetails;
