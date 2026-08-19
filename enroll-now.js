(()=>{
const c=window.sgaSupabase,$=id=>document.getElementById(id);
const digits=v=>String(v||'').replace(/\D/g,'');
function msg(t,ok=false){$('formMsg').textContent=t;$('formMsg').style.color=ok?'#267447':'#9a2f2f'}
$('mobile').addEventListener('input',e=>e.target.value=digits(e.target.value).slice(0,10));
$('parentMobile').addEventListener('input',e=>e.target.value=digits(e.target.value).slice(0,10));

$('enrollForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const studentName=$('studentName').value.trim();
 const mobile=digits($('mobile').value);
 const parentMobile=digits($('parentMobile').value);
 if(studentName.length<2)return msg('Enter student name.');
 if(mobile.length!==10)return msg('Enter a valid 10-digit student mobile number.');
 if(parentMobile && parentMobile.length!==10)return msg('Enter a valid 10-digit parent mobile number.');
 if(!$('consent').checked)return msg('Please confirm the contact consent.');

 const payload={
   student_name:studentName,
   mobile,
   parent_name:$('parentName').value.trim()||null,
   parent_mobile:parentMobile||null,
   current_class:$('currentClass').value||null,
   target_exam:$('targetExam').value||'NEET 2027',
   school_college:$('schoolCollege').value.trim()||null,
   location:$('location').value.trim()||null,
   message:$('message').value.trim()||null,
   status:'new'
 };

 $('submitBtn').disabled=true;msg('Submitting...');
 const {error}=await c.from('enrollments').insert(payload);
 $('submitBtn').disabled=false;
 if(error)return msg(error.message||'Unable to submit. Please try again.');

 $('formArea').style.display='none';
 $('successArea').classList.add('show');
 window.scrollTo({top:0,behavior:'smooth'});
});
})();